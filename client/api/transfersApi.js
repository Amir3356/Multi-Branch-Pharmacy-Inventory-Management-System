import { api } from '../utils/http'

// Stock transfer endpoints: one branch sends, the other adds the stock (Receive Stock)
export const TRANSFERS_ENDPOINTS = {
  list: '/transfers',
  receive: (id) => `/transfers/${encodeURIComponent(id)}/receive`
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchTransfers = () => api(TRANSFERS_ENDPOINTS.list)
export const createTransfer = (payload) => api(TRANSFERS_ENDPOINTS.list, { method: 'POST', body: payload })
export const receiveTransfer = (id, sellingPrice) => api(TRANSFERS_ENDPOINTS.receive(id), { method: 'POST', body: { sellingPrice } })
