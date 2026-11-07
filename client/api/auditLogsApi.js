import { api } from '../utils/http'

// The audit trail: the Owner reads it (filtered and paged by the server); entries can never be edited or deleted
export const AUDIT_LOGS_ENDPOINTS = { list: '/audit-logs', views: '/audit-logs/views' }

/** One page of entries, newest first. `filters`: { from, to, module, type, branchId, search, page }; empty ones are left out */
export const fetchAuditLogs = (filters) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null && value !== 'all'))
  return api(`${AUDIT_LOGS_ENDPOINTS.list}?${query}`)
}

/** Records that the signed-in user opened a page (`section`: a PATHS key). Never throws: a missed view never blocks the page. */
export const recordPageView = (section) => api(AUDIT_LOGS_ENDPOINTS.views, { method: 'POST', body: { section } }).catch(() => {})
