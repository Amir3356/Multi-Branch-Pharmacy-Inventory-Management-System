import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Filter, Plus, Search, X } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader, StatusTag } from '../components'
import { useBranchScope, useFormatMoney, useMoneyColumns } from '../hooks'
import { selectPurchases } from '../features/purchases/store/purchasesSlice'
import { selectProducts } from '../features/inventory/store/productsSlice'
import { selectProcurementCategories } from '../features/purchases/store/procurementCategoriesSlice'
import { loadProcurementCategories } from '../features/purchases/store/procurementCategoriesThunks'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { recordProcurement } from '../features/purchases/store/purchasesThunks'
import { deliveryStatus } from '../features/purchases/model/procurement'
import NewPurchaseModal from '../features/purchases/components/NewPurchaseModal'
import { formatTime } from '../utils'
import './PurchasePage.css'

export default function PurchasePage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const { branches, branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const allPurchases = useSelector(selectPurchases)
  const purchases = allPurchases.filter((p) => inScope(p.branchId))
  const products = useSelector(selectProducts)
  // The Category dropdown reads the Purchase Officer's Categories page
  const categories = useSelector(selectProcurementCategories).map((c) => c.name)
  const user = useSelector(selectCurrentUser)
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const [notice, setNotice] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [deliveryFilter, setDeliveryFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

  const categoryOptions = useMemo(() => {
    const fromPurchases = [...new Set(purchases.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    return fromPurchases.length ? fromPurchases : categories
  }, [purchases, categories])

  const supplierOptions = useMemo(() => {
    return [...new Set(purchases.map((p) => p.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [purchases])

  const deliveryOptions = ['Pending', 'Arrived']

  const filteredPurchases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return purchases.filter((po) => {
      if (categoryFilter !== 'all' && po.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false
      }
      if (supplierFilter !== 'all' && po.supplier?.toLowerCase() !== supplierFilter.toLowerCase()) {
        return false
      }
      if (deliveryFilter !== 'all' && deliveryStatus(po) !== deliveryFilter) {
        return false
      }
      if (isAllBranches && branchFilter !== 'all' && po.branchId !== branchFilter) {
        return false
      }
      if (!query) return true

      const matchSupplier = po.supplier?.toLowerCase().includes(query)
      const matchProduct = po.product?.toLowerCase().includes(query)
      const matchCategory = po.category?.toLowerCase().includes(query)
      const matchId = po.id?.toLowerCase().includes(query)
      const matchBatch = po.batch?.toLowerCase().includes(query)
      const matchDate = po.date?.toLowerCase().includes(query)
      const matchBranch = isAllBranches && branchById(po.branchId)?.name?.toLowerCase().includes(query)

      return Boolean(matchSupplier || matchProduct || matchCategory || matchId || matchBatch || matchDate || matchBranch)
    })
  }, [purchases, searchQuery, categoryFilter, supplierFilter, deliveryFilter, branchFilter, isAllBranches, branchById])

  const filtersActive = Boolean(
    searchQuery.trim() ||
    categoryFilter !== 'all' ||
    supplierFilter !== 'all' ||
    deliveryFilter !== 'all' ||
    (isAllBranches && branchFilter !== 'all')
  )

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setSupplierFilter('all')
    setDeliveryFilter('all')
    setBranchFilter('all')
  }

  // Categories for the Create Procurement dropdown, as kept on the Categories page
  useEffect(() => {
    dispatch(loadProcurementCategories()).catch((error) => setNotice({ type: 'error', text: `Categories couldn't be loaded: ${error.message}` }))
  }, [dispatch])

  // Records the paid order; its stock arrives when the receiving branch adds it (Receive Stock).
  // Errors are thrown back to the modal so it can show them next to the form.
  const handleCreatePurchase = async (data, idempotencyKey) => {
    const message = await dispatch(recordProcurement(data, idempotencyKey))
    setShowNewPurchase(false)
    setNotice({ type: 'success', text: message })
  }

  return (
    <div className="content-section-card">
      <PageHeader centered title={`Procurement · ${scopeLabel}`} description="Generate purchase orders to distributors and receive incoming stock into a specific branch.">
        <button type="button" className="primary-action-btn" onClick={() => setShowNewPurchase(true)}>
          <Plus size={16} /> Purchase
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      {/* Search & Filters */}
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            type="search"
            className="input-field"
            placeholder="Search by supplier, product, category, or order ID…"
            aria-label="Search purchases"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="input-field filter-select"
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {supplierOptions.length > 0 && (
          <select
            className="input-field filter-select"
            aria-label="Filter by supplier"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="all">All Suppliers</option>
            {supplierOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        <select
          className="input-field filter-select"
          aria-label="Filter by delivery"
          value={deliveryFilter}
          onChange={(e) => setDeliveryFilter(e.target.value)}
        >
          <option value="all">All Deliveries</option>
          {deliveryOptions.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        {isAllBranches && branches.length > 0 && (
          <select
            className="input-field filter-select"
            aria-label="Filter by branch"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="filter-summary">
        <span>
          <Filter size={14} /> <strong>{filteredPurchases.length}</strong> of {purchases.length} {purchases.length === 1 ? 'order' : 'orders'} match
        </span>
        {filtersActive && (
          <button type="button" className="link-btn" onClick={clearFilters}>
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Supplier</th>
              {isAllBranches && <th>Receiving Branch</th>}
              <th>Category</th>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>{moneyHeader('Unit Purchase Price')}</th>
              <th>{moneyHeader('Total Cost')}</th>
              <th>Purchased On</th>
              <th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.map((po) => (
              <tr key={po.id}>
                <td className="fw-600">{po.supplier}</td>
                {isAllBranches && <td><BranchTag branch={branchById(po.branchId)} /></td>}
                <td>{po.category}</td>
                <td className="fw-600">{po.product}</td>
                <td>{po.qty.toLocaleString()} units</td>
                <td>{formatAmount(po.purchasePrice)}</td>
                <td className="fw-600">{formatAmount(po.total)}</td>
                <td className="nowrap">
                  {po.date}
                  {po.createdAt && <div className="page-desc" style={{ margin: 0 }}>{formatTime(new Date(po.createdAt))}</div>}
                </td>
                {/* Pending until the receiving branch's Inventory Officer adds the stock (Receive Stock), then Arrived */}
                <td>
                  {deliveryStatus(po) ? <StatusTag status={deliveryStatus(po)} /> : '—'}
                  {po.receivedAt && po.batch && <div className="page-desc" style={{ margin: 0 }}>Batch {po.batch}</div>}
                </td>
              </tr>
            ))}
            {filteredPurchases.length === 0 && (
              <EmptyRow colSpan={isAllBranches ? 9 : 8}>
                {filtersActive ? 'No purchase records match the filters.' : 'No procurement records found.'}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </div>

      {showNewPurchase && (
        <NewPurchaseModal
          branches={branches}
          assignedBranchId={user?.branchId === 'all' ? null : user?.branchId}
          products={products}
          categories={categories}
          suppliers={[...new Set(allPurchases.map((p) => p.supplier))].sort()}
          formatMoney={formatMoney}
          onClose={() => setShowNewPurchase(false)}
          onSave={handleCreatePurchase}
        />
      )}
    </div>
  )
}
