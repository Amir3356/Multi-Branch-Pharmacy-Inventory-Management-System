import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Filter, Plus, Search, X } from 'lucide-react'
import { EmptyRow, Notice, PageHeader } from '../components'
import { useMoneyColumns } from '../hooks'
import { selectProducts } from '../features/inventory/store/productsSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectPurchases } from '../features/purchases/store/purchasesSlice'
import { addProduct, addProductBatch } from '../features/inventory/store/productsThunks'
import { selectProcurementCategories } from '../features/purchases/store/procurementCategoriesSlice'
import { addProcurementCategory, loadProcurementCategories } from '../features/purchases/store/procurementCategoriesThunks'
import CatalogEntryModal from '../features/purchases/components/CatalogEntryModal'

// Category & Product (Purchase Officer): every category with the products filed under it, which is what Create
// Procurement's Category and Product Name lists offer. Add Category & Product opens the form with both fields; saving a
// product generates its Batch ID (saving the same product again gives it another one). Each batch is its own row:
// procurements buy under a Batch ID and the Inventory Officer receives the stock under the same one (Inventory page).
export default function CategoryProductPage() {
  const dispatch = useDispatch()
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const categories = useSelector(selectProcurementCategories)
  const products = useSelector(selectProducts)
  const purchases = useSelector(selectPurchases)
  const inventory = useSelector(selectInventory)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')

  useEffect(() => {
    dispatch(loadProcurementCategories())
      .catch((error) => setNotice({ type: 'error', text: error.message }))
      .finally(() => setIsLoading(false))
  }, [dispatch])

  // One row per Batch ID (oldest first) of each product, A to Z within each category; a product with no batch yet gets
  // one row, and a category with no products yet gets one row of its own
  const rows = useMemo(() => {
    return categories.flatMap((c) => {
      const inCategory = products
        .filter((p) => p.category?.toLowerCase() === c.name?.toLowerCase())
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      return inCategory.length
        ? inCategory.flatMap((p) =>
            p.batches?.length
              ? p.batches.map((b, i) => ({ key: `${p.id}-${b.batch}`, category: c.name, product: p, batch: b.batch, firstBatch: i === 0 }))
              : [{ key: p.id, category: c.name, product: p, batch: null, firstBatch: true }]
          )
        : [{ key: `c-${c.id}`, category: c.name, product: null, batch: null }]
    })
  }, [categories, products])

  const productOptions = useMemo(() => {
    const sourceRows = categoryFilter !== 'all'
      ? rows.filter((r) => r.category.toLowerCase() === categoryFilter.toLowerCase())
      : rows
    const names = sourceRows.map((r) => r.product?.name).filter(Boolean)
    return [...new Set(names)].sort((a, b) => a.localeCompare(b))
  }, [rows, categoryFilter])

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return rows.filter((row) => {
      if (categoryFilter !== 'all' && row.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false
      }
      if (productFilter !== 'all' && row.product?.name?.toLowerCase() !== productFilter.toLowerCase()) {
        return false
      }
      if (!query) return true
      const matchName = row.product?.name?.toLowerCase().includes(query)
      const matchCategory = row.category?.toLowerCase().includes(query)
      const matchBatch = row.batch?.toLowerCase().includes(query)
      return Boolean(matchName || matchCategory || matchBatch)
    })
  }, [rows, categoryFilter, productFilter, searchQuery])

  const filtersActive = Boolean(searchQuery.trim()) || categoryFilter !== 'all' || productFilter !== 'all'

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setProductFilter('all')
  }

  const price = (value) => (value === null || value === undefined ? '—' : formatAmount(value))

  // From the batch's paid procurements: Total Cost is everything spent on it, Unit Purchase Price the latest order's
  // (falling back to the catalog's price). Orders match by product id, else by name within the same category, then by
  // Batch ID; orders not bought under one of the product's batches (older ones) count towards its first batch.
  const costs = (product, batch, firstBatch) => {
    const productBatches = new Set((product.batches ?? []).map((b) => b.batch))
    const paid = purchases.filter(
      (o) =>
        o.status === 'Paid' &&
        (o.medId ? o.medId === product.id : o.product?.toLowerCase() === product.name.toLowerCase() && o.category?.toLowerCase() === product.category.toLowerCase()) &&
        (o.batch && productBatches.has(o.batch) ? o.batch === batch : firstBatch)
    )
    const latest = paid.reduce((a, b) => ((b.createdAt || b.date) > (a?.createdAt || a?.date || '') ? b : a), null)
    return {
      total: paid.length ? paid.reduce((sum, o) => sum + o.total, 0) : null,
      unit: latest ? latest.purchasePrice : product.purchasePrice
    }
  }

  // Total Selling Price, as the Inventory page shows it (Current Stock × Unit Selling Price), added up over the batch's
  // stock at every branch (stock under a batch that isn't one of the product's counts towards its first batch).
  // null ("—") while none of its stock has a selling price yet.
  const totalSellingPrice = (product, batch, firstBatch) => {
    const productBatches = new Set((product.batches ?? []).map((b) => b.batch))
    const priced = inventory.filter(
      (i) => i.medId === product.id && i.stock > 0 && i.sellingPrice != null && (productBatches.has(i.batch) ? i.batch === batch : firstBatch)
    )
    return priced.length ? priced.reduce((sum, i) => sum + i.stock * i.sellingPrice, 0) : null
  }

  return (
    <div className="content-section-card">
      <PageHeader centered title="Category & Product" description="The categories and products you can pick when you create a procurement.">
        <button type="button" className="primary-action-btn" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add Category & Product
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
            placeholder="Search by product name, category or Batch ID…"
            aria-label="Search category and product"
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
              const stillValid = rows.some((r) => (cat === 'all' || r.category?.toLowerCase() === cat.toLowerCase()) && r.product?.name?.toLowerCase() === productFilter.toLowerCase())
              if (!stillValid) setProductFilter('all')
            }
          }}
        >
          <option value="all">Category</option>
          {categories.map((c) => (
            <option key={c.id ?? c.name} value={c.name}>
              {c.name}
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
      </div>

      <div className="filter-summary">
        <span>
          <Filter size={14} /> <strong>{filteredRows.length}</strong> of {rows.length} {rows.length === 1 ? 'item' : 'items'} match
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
              <th>Batch ID</th>
              <th>Category</th>
              <th>Product Name</th>
              <th>{moneyHeader('Total Cost')}</th>
              <th>{moneyHeader('Unit Purchase Price')}</th>
              <th>{moneyHeader('Selling Price')}</th>
              <th>{moneyHeader('Total Selling Price')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const cost = row.product ? costs(row.product, row.batch, row.firstBatch) : null
              return (
                <tr key={row.key}>
                  <td className="nowrap">{row.batch ? <span className="batch-badge">{row.batch}</span> : '—'}</td>
                  <td>{row.category}</td>
                  <td className="fw-600">{row.product ? row.product.name : <span className="field-hint">No products yet</span>}</td>
                  <td className="nowrap">{cost ? price(cost.total) : '—'}</td>
                  <td className="nowrap">{cost ? price(cost.unit) : '—'}</td>
                  <td className="nowrap">{row.product ? price(row.product.sellingPrice) : '—'}</td>
                  <td className="nowrap">{row.product ? price(totalSellingPrice(row.product, row.batch, row.firstBatch)) : '—'}</td>
                </tr>
              )
            })}
            {filteredRows.length === 0 && (
              <EmptyRow colSpan={7}>
                {isLoading
                  ? 'Loading…'
                  : rows.length === 0
                  ? 'Nothing yet. Click Add Category & Product to add one.'
                  : 'No categories or products match your search or filter.'}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CatalogEntryModal
          categories={categories.map((c) => c.name)}
          products={products}
          onClose={() => setShowForm(false)}
          onAddCategory={(name) => dispatch(addProcurementCategory(name))}
          onAddProduct={(data) => dispatch(addProduct(data))}
          onAddBatch={(product) => dispatch(addProductBatch(product))}
          onDone={(text) => {
            setShowForm(false)
            setNotice({ type: 'success', text })
          }}
        />
      )}
    </div>
  )
}
