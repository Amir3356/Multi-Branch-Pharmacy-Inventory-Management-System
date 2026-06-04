import { api } from '../utils/http'

// Procurement endpoints
export const PROCUREMENTS_ENDPOINTS = {
  list: '/procurements',
  receive: (id) => `/procurements/${encodeURIComponent(id)}/receive`
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchProcurements = () => api(PROCUREMENTS_ENDPOINTS.list)
// The same idempotencyKey on a retry returns the order already recorded instead of recording it twice. After 20 seconds
// without an answer it gives up, so the Purchase Officer can retry with the same key rather than wait on a dead connection.
export const createProcurement = (data, idempotencyKey) =>
  api(PROCUREMENTS_ENDPOINTS.list, { method: 'POST', body: data, headers: { 'Idempotency-Key': idempotencyKey }, timeoutMs: 20000 })
// Inventory Officer: add a paid order's stock to their branch, with the expiry on the package (the batch is generated)
export const receiveProcurement = (id, { expiryDate, sellingPrice }) => api(PROCUREMENTS_ENDPOINTS.receive(id), { method: 'POST', body: { expiryDate, sellingPrice } })
