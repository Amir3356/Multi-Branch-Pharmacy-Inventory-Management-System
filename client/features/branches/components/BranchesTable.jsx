import { useTable } from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import {
  Search,
  Filter,
  X,
  Trash2,
  Pencil,
  Power
} from 'lucide-react'
import { listTableFeatures } from '../../../utils'
import { StatusTag, SortableHeader } from '../../../components'

const BRANCH_STATUSES = ['Active', 'Inactive']

// Search matches the branch name, ID, or location
const branchSearchFn = (row, _columnId, value) => {
  const query = String(value).trim().toLowerCase()
  const { name, id, location } = row.original
  return [name, id, location].some((field) => String(field).toLowerCase().includes(query))
}

export default function BranchesTable({ data, selectedBranch, onEdit, onToggleStatus, onDelete }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [sorting, setSorting] = useState([])

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Branch Name',
      sortFn: 'text',
      cell: (info) => (
        <span className="fw-600">
          {info.getValue()}
          {info.row.original.id === selectedBranch && <span className="current-chip">Viewing</span>}
        </span>
      )
    },
    { accessorKey: 'location', header: 'Location', sortFn: 'text' },
    { accessorKey: 'status', header: 'Status', filterFn: 'equalsString', sortFn: 'text', cell: (info) => <StatusTag status={info.getValue()} /> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: (info) => {
        const b = info.row.original
        const isActive = b.status === 'Active'
        return (
          <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="icon-btn" onClick={() => onEdit(b)} aria-label={`Edit ${b.name}`} title="Edit">
              <Pencil size={15} />
            </button>
            <button
              type="button"
              className={`icon-btn ${isActive ? 'deactivate-btn' : 'activate-btn'}`}
              onClick={() => onToggleStatus(b)}
              aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${b.name}`}
              title={isActive ? 'Deactivate' : 'Activate'}
            >
              <Power size={15} />
            </button>
            <button type="button" className="icon-danger-btn" onClick={() => onDelete(b)} aria-label={`Delete ${b.name}`} title="Delete">
              <Trash2 size={15} />
            </button>
          </div>
        )
      }
    }
  ], [selectedBranch, onEdit, onToggleStatus, onDelete])

  const table = useTable({
    features: listTableFeatures,
    columns,
    data,
    state: { globalFilter, columnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    globalFilterFn: branchSearchFn,
    getColumnCanGlobalFilter: (column) => column.id === 'name'
  })

  const statusFilter = columnFilters.find((f) => f.id === 'status')?.value ?? 'all'
  const filtersActive = Boolean(globalFilter) || columnFilters.length > 0 || sorting.length > 0
  const matchingCount = table.getFilteredRowModel().rows.length

  const clearFilters = () => {
    setGlobalFilter('')
    setColumnFilters([])
    setSorting([])
  }

  return (
    <>
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            type="search"
            className="input-field"
            placeholder="Search by name or location..."
            aria-label="Search branches"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>

        <select
          className="input-field filter-select"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => table.getColumn('status')?.setFilterValue(e.target.value === 'all' ? undefined : e.target.value)}
        >
          <option value="all">All Statuses</option>
          {BRANCH_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      <div className="filter-summary">
        <span>
          <Filter size={14} /> <strong>{matchingCount}</strong> of {data.length} branches match
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
                <th>No</th>
                {group.headers.map((header) => (
                  <SortableHeader key={header.id} header={header} table={table} />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {matchingCount === 0 && (
              <tr>
                <td colSpan={columns.length + 1} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  {data.length ? 'No branches match your search or filters.' : 'No branches yet. Click Create Branch to create the first one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
