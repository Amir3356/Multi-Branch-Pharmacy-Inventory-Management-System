import { api } from '../utils/http'

// Procurement categories (procurement-service): the Purchase Officer's Categories page and Create Procurement's list
export const PROCUREMENT_CATEGORIES_ENDPOINTS = {
  list: '/procurements/categories',
  one: (id) => `/procurements/categories/${encodeURIComponent(id)}`
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchProcurementCategories = () => api(PROCUREMENT_CATEGORIES_ENDPOINTS.list)
export const createProcurementCategory = (name) => api(PROCUREMENT_CATEGORIES_ENDPOINTS.list, { method: 'POST', body: { name } })
export const renameProcurementCategory = (id, name) => api(PROCUREMENT_CATEGORIES_ENDPOINTS.one(id), { method: 'PATCH', body: { name } })
export const destroyProcurementCategory = (id) => api(PROCUREMENT_CATEGORIES_ENDPOINTS.one(id), { method: 'DELETE' })
