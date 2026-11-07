import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

// Table header cell for a TanStack Table column: click to sort, with a direction arrow
export default function SortableHeader({ header, table }) {
  const sorted = header.column.getIsSorted()
  return (
    <th aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}>
      {header.isPlaceholder ? null : header.column.getCanSort() ? (
        <button type="button" className="sort-header-btn" onClick={header.column.getToggleSortingHandler()}>
          <table.FlexRender header={header} />
          {sorted === 'asc' ? <ArrowUp size={13} /> : sorted === 'desc' ? <ArrowDown size={13} /> : <ArrowUpDown size={13} className="sort-idle" />}
        </button>
      ) : (
        <table.FlexRender header={header} />
      )}
    </th>
  )
}
