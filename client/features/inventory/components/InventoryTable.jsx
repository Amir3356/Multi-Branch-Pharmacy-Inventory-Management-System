import { useTable } from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import {
  Clock,
  Search,
  Filter,
  X,
  Pencil
} from 'lucide-react'
import { useMoneyColumns } from '../../../hooks'
import { listTableFeatures, INVENTORY_STATUSES, formatDMY } from '../../../utils'
import { StatusTag, BranchTag, SortableHeader } from '../../../components'


const INVENTORY_SORTS = {
  'name-asc': { label: 'Name (A–Z)', sorting: [{ id: 'name', desc: false }] },
  'name-desc': { label: 'Name (Z–A)', sorting: [{ id: 'name', desc: true }] },
  'stock-asc': { label: 'Stock (low to high)', sorting: [{ id: 'stock', desc: false }] },
  'stock-desc': { label: 'Stock (high to low)', sorting: [{ id: 'stock', desc: true }] },
  'expiry-asc': { label: 'Expiry (soonest first)', sorting: [{ id: 'expiry', desc: false }] },
  'price-desc': { label: 'Selling price (high to low)', sorting: [{ id: 'sellingPrice', desc: true }] }
}


const INVENTORY_DEFAULT_SORTING = INVENTORY_SORTS['name-asc'].sorting

// Search matches the product name, SKU code, or batch number
const inventorySearchFn = (row, _columnId, value) => {
  const query = String(value).trim().toLowerCase()
  const { name, id, batch } = row.original
  return [name, id, batch].some((field) => field.toLowerCase().includes(query))
}

export default function InventoryTable({ data, branches, categories, showBranch, onEdit }) {
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [sorting, setSorting] = useState(INVENTORY_DEFAULT_SORTING)

  const columns = useMemo(() => {
    const branchName = (id) => branches.find((b) => b.id === id)?.name || ''
    return [
      // First column: the Batch ID the system generated when this stock was received (Receive Stock)
      { accessorKey: 'batch', header: 'Batch ID', sortFn: 'text', cell: (info) => <span className="batch-badge">{info.getValue()}</span> },
      ...(showBranch
        ? [{
            accessorKey: 'branchId',
            header: 'Branch',
            filterFn: 'equalsString',
            sortFn: (a, b) => branchName(a.original.branchId).localeCompare(branchName(b.original.branchId)),
            cell: (info) => <BranchTag branch={branches.find((b) => b.id === info.getValue())} />
          }]
        : []),
      { accessorKey: 'category', header: 'Category', filterFn: 'equalsString', sortFn: 'text' },
      { accessorKey: 'name', header: 'Product', filterFn: 'equalsString', sortFn: 'text', cell: (info) => <span className="fw-600">{info.getValue()}</span> },
      { accessorKey: 'stock', header: 'Current Stock', sortFn: 'basic', cell: (info) => `${info.getValue()} units` },
      { accessorKey: 'purchasePrice', header: moneyHeader('Unit Purchase Price'), sortFn: 'basic', cell: (info) => formatAmount(info.getValue()) },
      // What the whole procurement this batch arrived from cost, as on the Procurement page ("—" for transferred stock)
      { accessorKey: 'procurementTotal', header: moneyHeader('Total Cost'), sortFn: 'basic', sortUndefined: 'last', cell: (info) => (info.getValue() == null ? '—' : formatAmount(info.getValue())) },
      // The whole quantity's purchase cost: Current Stock × unit purchase price
      { id: 'totalCost', accessorFn: (row) => row.stock * (row.purchasePrice || 0), header: moneyHeader('Stock Value'), sortFn: 'basic', cell: (info) => formatAmount(info.getValue()) },
      { accessorKey: 'sellingPrice', header: moneyHeader('Unit Selling Price'), sortFn: 'basic', sortUndefined: 'last', cell: (info) => (info.getValue() == null ? <span className="not-set">Not set</span> : formatAmount(info.getValue())) },
      // What the row's whole stock would sell for: Current Stock × Unit Selling Price (Not set until it has a price)
      { id: 'totalSellingPrice', accessorFn: (row) => (row.sellingPrice == null ? undefined : row.stock * row.sellingPrice), header: moneyHeader('Total Selling Price'), sortFn: 'basic', sortUndefined: 'last', cell: (info) => (info.getValue() == null ? <span className="not-set">Not set</span> : formatAmount(info.getValue())) },
      {
        accessorKey: 'expiry',
        header: 'Expiration Date',
        sortFn: 'text',
        sortUndefined: 'last',
        cell: (info) => {
          const val = formatDMY(info.getValue())
          return info.row.original.expiringSoon ? (
            <span className="expiry-warning" title="Expiring soon">
              <Clock size={13} /> {val}
            </span>
          ) : (
            val
          )
        }
      },
      { id: 'status', accessorKey: 'inventoryStatus', header: 'Status', filterFn: 'equalsString', sortFn: 'text', cell: (info) => <StatusTag status={info.getValue()} /> },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: (info) => {
          const item = info.row.original
          return (
            <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="icon-btn" onClick={() => onEdit(item)} aria-label={`Edit ${item.name} at ${branches.find((b) => b.id === item.branchId)?.name}`} title="Edit">
                <Pencil size={15} />
              </button>
            </div>
          )
        }
      }
    ]
  }, [branches, showBranch, moneyHeader, formatAmount, onEdit])

  // The branch filter only applies while the Branch column is shown
  const activeColumnFilters = showBranch ? columnFilters : columnFilters.filter((f) => f.id !== 'branchId')

  const table = useTable({
    features: listTableFeatures,
    columns,
    data,
    state: { globalFilter, columnFilters: activeColumnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    globalFilterFn: inventorySearchFn,
    getColumnCanGlobalFilter: (column) => column.id === 'name'
  })

  const filterValue = (id) => activeColumnFilters.find((f) => f.id === id)?.value ?? 'all'
  const setFilter = (id, value) => {
    table.getColumn(id)?.setFilterValue(value === 'all' ? undefined : value)
  }

  const sortKey = Object.keys(INVENTORY_SORTS).find((key) => JSON.stringify(INVENTORY_SORTS[key].sorting) === JSON.stringify(sorting)) ?? (sorting.length ? 'custom' : 'none')
  const filtersActive = Boolean(globalFilter) || activeColumnFilters.length > 0 || sortKey !== 'name-asc'

  const clearFilters = () => {
    setGlobalFilter('')
    setColumnFilters([])
    setSorting(INVENTORY_DEFAULT_SORTING)
  }

  const matchingCount = table.getFilteredRowModel().rows.length
  const visibleColumnCount = columns.length

  const categoryHeader = table.getColumn('category')?.columnDef.header || 'Category'
  const categoryOptions = useMemo(() => {
    const fromData = [...new Set(data.map((item) => item.category).filter(Boolean))].sort()
    return fromData.length ? fromData : categories
  }, [data, categories])

  const selectedCategory = filterValue('category')
  const productOptions = useMemo(() => {
    const sourceData = selectedCategory && selectedCategory !== 'all'
      ? data.filter((item) => item.category === selectedCategory)
      : data
    return [...new Set(sourceData.map((item) => item.name).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [data, selectedCategory])

  return (
    <>
      {/* Search & Filters */}
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            type="search"
            className="input-field"
            placeholder="Search by name, SKU, or batch..."
            aria-label="Search inventory"
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
            }}
          />
        </div>

        <select
          className="input-field filter-select"
          aria-label="Filter by category"
          value={filterValue('category')}
          onChange={(e) => {
            const cat = e.target.value
            setFilter('category', cat)
            if (filterValue('name') !== 'all') {
              const stillValid = data.some((item) => (cat === 'all' || item.category === cat) && item.name === filterValue('name'))
              if (!stillValid) {
                setFilter('name', 'all')
              }
            }
          }}
        >
          <option value="all">{categoryHeader}</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          className="input-field filter-select"
          aria-label="Filter by product"
          value={filterValue('name')}
          onChange={(e) => setFilter('name', e.target.value)}
        >
          <option value="all">Product</option>
          {productOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select className="input-field filter-select" aria-label="Filter by status" value={filterValue('status')} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="all">All Statuses</option>
          {INVENTORY_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        {showBranch && (
          <select className="input-field filter-select" aria-label="Filter by branch" value={filterValue('branchId')} onChange={(e) => setFilter('branchId', e.target.value)}>
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

      </div>

      <div className="filter-summary">
        <span>
          <Filter size={14} /> <strong>{matchingCount}</strong> of {data.length} items match
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
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <SortableHeader key={header.id} header={header} table={table} />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {matchingCount === 0 && (
              <tr>
                <td colSpan={visibleColumnCount} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  No products match your search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </>
  )
}
