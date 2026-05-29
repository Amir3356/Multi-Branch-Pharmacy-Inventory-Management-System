import { api } from '../utils/http'

// Each branch's stock per batch, held by the server: sales, transfers, damage and received orders change it there
export const STOCK_ENDPOINTS = {
  list: '/stock',
  batch: (id) => `/stock/${encodeURIComponent(id)}`
}

// Returns the API's JSON; failures throw ApiError
export const fetchStock = () => api(STOCK_ENDPOINTS.list)

// Inventory Officer: correct a batch's counted units and expiry. expectedStock is what the screen showed, so a sale made
// meanwhile isn't overwritten (the API answers 409 instead).
export const correctStockBatch = (id, { stock, expiry, expectedStock }) =>
  api(STOCK_ENDPOINTS.batch(id), { method: 'PATCH', body: { stock, expiry: expiry || null, expectedStock } })
