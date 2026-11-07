import {
  tableFeatures,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  sortFn_text,
  sortFn_basic
} from '@tanstack/react-table'

// TanStack Table features shared by the list tables (module-level so they stay stable)
export const listTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { equalsString: filterFn_equalsString },
  sortFns: { text: sortFn_text, basic: sortFn_basic }
})
