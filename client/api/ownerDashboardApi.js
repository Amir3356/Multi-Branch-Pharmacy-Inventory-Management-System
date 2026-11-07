import { api } from '../utils/http'

// The Owner's dashboard figures, worked out by the server
export const OWNER_DASHBOARD_ENDPOINTS = { summary: '/dashboard/owner' }

/** { totals, now, daily, branches, topProducts } for a period (YYYY-MM-DD, inclusive), every branch or one */
export const fetchOwnerDashboard = ({ from, to, branchId }) =>
  api(`${OWNER_DASHBOARD_ENDPOINTS.summary}?${new URLSearchParams({ from, to, ...(branchId && branchId !== 'all' ? { branchId } : {}) })}`)
