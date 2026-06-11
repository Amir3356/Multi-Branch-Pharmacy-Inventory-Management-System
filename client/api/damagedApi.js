import { api } from '../utils/http'

// Damaged stock written off at a branch: the Inventory Officer records it, everyone's stock follows
export const DAMAGED_ENDPOINTS = {
  list: '/damaged-items'
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchDamagedItems = () => api(DAMAGED_ENDPOINTS.list)
export const createDamagedItem = (payload) => api(DAMAGED_ENDPOINTS.list, { method: 'POST', body: payload })
