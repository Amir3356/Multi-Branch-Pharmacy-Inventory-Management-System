import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Filter, Plus, Search, X } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader, StatusTag } from '../components'
import { useBranchScope, useMoneyColumns } from '../hooks'
import { formatDMY, formatTime } from '../utils'
import { selectSales } from '../features/sales/store/salesSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectCategories } from '../features/inventory/store/productsSlice'
import { recordSale } from '../features/sales/store/salesThunks'
import NewSaleModal from '../features/sales/components/NewSaleModal'
import './SalesPage.css'

export default function SalesPage() {
  const dispatch = useDispatch()
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const { branches, branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const sales = useSelector(selectSales).filter((s) => inScope(s.branchId))
  const inventory = useSelector(selectInventory)
  const categories = useSelector(selectCategories)
  const [showNewSale, setShowNewSale] = useState(false)
  const [notice, setNotice] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

  const categoryOptions = useMemo(() => {
    const fromSales = [...new Set(sales.map((s) => s.category).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    return fromSales.length ? fromSales : categories
  }, [sales, categories])

  const productOptions = useMemo(() => {
    const sourceSales = categoryFilter !== 'all'
      ? sales.filter((s) => s.category?.toLowerCase() === categoryFilter.toLowerCase())
      : sales
    return [...new Set(sourceSales.map((s) => s.product).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [sales, categoryFilter])

  const filteredSales = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sales.filter((sale) => {
      if (categoryFilter !== 'all' && sale.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false
      }
      if (productFilter !== 'all' && sale.product?.toLowerCase() !== productFilter.toLowerCase()) {
        return false
      }
      if (isAllBranches && branchFilter !== 'all' && sale.branchId !== branchFilter) {
        return false
      }
      if (!query) return true

      const matchCustomer = sale.customer?.toLowerCase().includes(query)
      const matchProduct = sale.product?.toLowerCase().includes(query)
      const matchCategory = sale.category?.toLowerCase().includes(query)
      const matchBatch = sale.batches?.some((b) => b.batch?.toLowerCase().includes(query))
      const matchId = sale.id?.toLowerCase().includes(query)
      const matchDate = sale.date?.toLowerCase().includes(query)
      const matchTime = (sale.time || (sale.createdAt ? formatTime(new Date(sale.createdAt)) : '')).toLowerCase().includes(query)
      const matchBranch = isAllBranches && branchById(sale.branchId)?.name?.toLowerCase().includes(query)

      return Boolean(matchCustomer || matchProduct || matchCategory || matchBatch || matchId || matchDate || matchTime || matchBranch)
    })
  }, [sales, searchQuery, categoryFilter, productFilter, branchFilter, isAllBranches, branchById])

  const filtersActive = Boolean(
    searchQuery.trim() ||
    categoryFilter !== 'all' ||
    productFilter !== 'all' ||
    (isAllBranches && branchFilter !== 'all')
  )

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setProductFilter('all')
    setBranchFilter('all')
  }

  const handleRecordSale = async (data, idempotencyKey) => {
    // Saved on the server; the form shows any error
    const { message } = await dispatch(recordSale(data, idempotencyKey))
    setNotice({ type: 'success', text: message })
    setShowNewSale(false)
  }

  const colSpan = isAllBranches ? 9 : 8

  return (
    <div className="content-section-card">
      <PageHeader centered title={`Sales History · ${scopeLabel}`} description="Record of sales transactions, receipts, and customer purchases per branch.">
        <button className="primary-action-btn" onClick={() => setShowNewSale(true)}>
          <Plus size={16} /> Sale
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
            placeholder="Search by customer, product, category, batch ID, or sale ID…"
            aria-label="Search sales"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="input-field filter-select"
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => {
            const cat = e.target.value
            setCategoryFilter(cat)
            if (productFilter !== 'all') {
              const stillValid = sales.some(
                (s) =>
                  (cat === 'all' || s.category?.toLowerCase() === cat.toLowerCase()) &&
                  s.product?.toLowerCase() === productFilter.toLowerCase()
              )
              if (!stillValid) setProductFilter('all')
            }
          }}
        >
          <option value="all">Category</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="input-field filter-select"
          aria-label="Filter by product"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
        >
          <option value="all">Product</option>
          {productOptions.map((p) => (
            <option key={p} value={p}>
              {p}
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
            <option value="all">Branch</option>
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
          <Filter size={14} /> <strong>{filteredSales.length}</strong> of {sales.length} {sales.length === 1 ? 'sale' : 'sales'} match
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
              <th>Customer</th>
              {isAllBranches && <th>Branch</th>}
              <th>Category</th>
              <th>Product Name</th>
              <th>Batch ID</th>
              <th>Items Purchased</th>
              <th>{moneyHeader('Total Amount')}</th>
              <th>Date &amp; Time Sold</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <EmptyRow colSpan={colSpan}>
                {filtersActive ? 'No sales match these filters.' : 'No sales recorded yet.'}
              </EmptyRow>
            ) : (
              filteredSales.map((sale) => (
                <tr key={sale.id}>
                  <td className="fw-600">{sale.customer}</td>
                  {isAllBranches && <td><BranchTag branch={branchById(sale.branchId)} /></td>}
                  <td>{sale.category}</td>
                  <td className="fw-600">{sale.product}</td>
                  <td className="nowrap">
                    {sale.batches?.length ? (
                      sale.batches.map((b) => (
                        <span key={b.batch} className="batch-badge">
                          {b.batch}
                        </span>
                      ))
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{sale.qty} {sale.qty === 1 ? 'unit' : 'units'}</td>
                  <td className="fw-600">{formatAmount(sale.total)}</td>
                  <td className="nowrap">
                    {sale.createdAt ? (
                      <>
                        <div className="fw-600">{formatDMY(sale.createdAt)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {formatTime(new Date(sale.createdAt))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="fw-600">{formatDMY(sale.date)}</div>
                        {sale.time && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {sale.time}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td><StatusTag status={sale.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showNewSale && (
        <NewSaleModal branches={branches.filter((b) => inScope(b.id))} inventory={inventory.filter((i) => inScope(i.branchId))} categories={categories} onClose={() => setShowNewSale(false)} onSave={handleRecordSale} />
      )}
    </div>
  )
}
