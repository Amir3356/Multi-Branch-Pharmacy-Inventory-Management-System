import { api } from '../utils/http'

// Procurement endpoints (paid through Chapa)
export const PROCUREMENTS_ENDPOINTS = {
  list: '/procurements',
  verify: (id) => `/procurements/${encodeURIComponent(id)}/verify`,
  receive: (id) => `/procurements/${encodeURIComponent(id)}/receive`
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchProcurements = () => api(PROCUREMENTS_ENDPOINTS.list)
export const createProcurement = (data) => api(PROCUREMENTS_ENDPOINTS.list, { method: 'POST', body: data })
export const verifyProcurementPayment = (id) => api(PROCUREMENTS_ENDPOINTS.verify(id), { method: 'POST' })
// Inventory Officer: add a paid order's stock to their branch, with the expiry on the package (the batch is generated)
export const receiveProcurement = (id, { expiryDate, sellingPrice }) => api(PROCUREMENTS_ENDPOINTS.receive(id), { method: 'POST', body: { expiryDate, sellingPrice } })
