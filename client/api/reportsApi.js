import { api } from '../utils/http'

// The Owner's reports: each for a period (YYYY-MM-DD, inclusive) and every branch or one
export const REPORT_ENDPOINTS = {
  sales: '/reports/sales',
  inventory: '/reports/inventory',
  financial: '/reports/financial',
  procurement: '/reports/procurement',
  users: '/reports/users'
}

/** One report's figures; `branchId` 'all' (or empty) means every branch. Throws ApiError. */
export const fetchReport = (kind, { from, to, branchId }) => {
  const query = new URLSearchParams({ from, to, ...(branchId && branchId !== 'all' ? { branchId } : {}) })
  return api(`${REPORT_ENDPOINTS[kind]}?${query}`)
}
