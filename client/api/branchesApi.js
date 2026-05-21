import { api } from '../utils/http'

// Branch endpoints (listing for everyone; changes are Owner only)
export const BRANCHES_ENDPOINTS = {
  list: '/branches',
  branch: (id) => `/branches/${id}`
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchBranches = () => api(BRANCHES_ENDPOINTS.list)
export const createBranch = (data) => api(BRANCHES_ENDPOINTS.list, { method: 'POST', body: data })
export const patchBranch = (id, data) => api(BRANCHES_ENDPOINTS.branch(id), { method: 'PATCH', body: data })
export const destroyBranch = (id) => api(BRANCHES_ENDPOINTS.branch(id), { method: 'DELETE' })
