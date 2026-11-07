import { api } from '../utils/http'

// Sales endpoints: the Cashier records sales at their branch
export const SALES_ENDPOINTS = { list: '/sales' }

// Each call returns the API's JSON; failures throw ApiError
export const fetchSales = () => api(SALES_ENDPOINTS.list)
// The same idempotencyKey on a retry returns the sale already recorded instead of recording it twice. After 20 seconds
// without an answer it gives up, so the Cashier can retry with the same key rather than wait on a dead connection.
export const createSale = (payload, idempotencyKey) =>
  api(SALES_ENDPOINTS.list, { method: 'POST', body: payload, headers: { 'Idempotency-Key': idempotencyKey }, timeoutMs: 20000 })
