import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Filter, Plus, Search, X } from 'lucide-react'
import { EmptyRow, Notice, PageHeader } from '../components'
import { useMoneyColumns } from '../hooks'
import { selectProducts } from '../features/inventory/store/productsSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectPurchases } from '../features/purchases/store/purchasesSlice'
import { addProduct } from '../features/inventory/store/productsThunks'
import { selectProcurementCategories } from '../features/purchases/store/procurementCategoriesSlice'
import { addProcurementCategory, loadProcurementCategories } from '../features/purchases/store/procurementCategoriesThunks'
import CatalogEntryModal from '../features/purchases/components/CatalogEntryModal'

// Category & Product (Purchase Officer): every category with the products filed under it, which is what Create
// Procurement's Category and Product Name lists offer. Add Category & Product opens the form with both fields. Batch
// IDs aren't set here: the system generates one when the Inventory Officer receives the stock (Inventory page).
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

  // One row per product, A to Z within each category; a category with no products yet gets one row of its own
  const rows = useMemo(() => {
    return categories.flatMap((c) => {
      const inCategory = products
        .filter((p) => p.category?.toLowerCase() === c.name?.toLowerCase())
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      return inCategory.length
        ? inCategory.map((p) => ({ key: p.id, category: c.name, product: p }))
        : [{ key: `c-${c.id}`, category: c.name, product: null }]
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
      return Boolean(matchName || matchCategory)
    })
  }, [rows, categoryFilter, productFilter, searchQuery])

  const filtersActive = Boolean(searchQuery.trim()) || categoryFilter !== 'all' || productFilter !== 'all'

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setProductFilter('all')
  }

  const price = (value) => (value === null || value === undefined ? '—' : formatAmount(value))

  // From the product's paid procurements: Total Cost is everything spent on it, Unit Purchase Price the latest order's
  // (falling back to the catalog's price). Orders match by product id, else by name within the same category.
  const costs = (product) => {
    const paid = purchases.filter(
      (o) =>
        o.status === 'Paid' &&
        (o.medId ? o.medId === product.id : o.product?.toLowerCase() === product.name.toLowerCase() && o.category?.toLowerCase() === product.category.toLowerCase())
    )
    const latest = paid.reduce((a, b) => ((b.createdAt || b.date) > (a?.createdAt || a?.date || '') ? b : a), null)
    return {
      total: paid.length ? paid.reduce((sum, o) => sum + o.total, 0) : null,
      unit: latest ? latest.purchasePrice : product.purchasePrice
    }
  }

  // Total Selling Price, as the Inventory page shows it (Current Stock × Unit Selling Price), added up over every batch
  // of the product in stock at any branch. null ("—") while none of its stock has a selling price yet.
  const totalSellingPrice = (product) => {
    const priced = inventory.filter((i) => i.medId === product.id && i.stock > 0 && i.sellingPrice != null)
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
            placeholder="Search by product name or category…"
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
              const cost = row.product ? costs(row.product) : null
              return (
                <tr key={row.key}>
                  <td>{row.category}</td>
                  <td className="fw-600">{row.product ? row.product.name : <span className="field-hint">No products yet</span>}</td>
                  <td className="nowrap">{cost ? price(cost.total) : '—'}</td>
                  <td className="nowrap">{cost ? price(cost.unit) : '—'}</td>
                  <td className="nowrap">{row.product ? price(row.product.sellingPrice) : '—'}</td>
                  <td className="nowrap">{row.product ? price(totalSellingPrice(row.product)) : '—'}</td>
                </tr>
              )
            })}
            {filteredRows.length === 0 && (
              <EmptyRow colSpan={6}>
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
          onDone={(text) => {
            setShowForm(false)
            setNotice({ type: 'success', text })
          }}
        />
      )}
    </div>
  )
}
