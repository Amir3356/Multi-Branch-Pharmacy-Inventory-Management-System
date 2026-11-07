import { api } from '../utils/http'

// A branch's expenses: the Inventory Officer records and deletes them
export const EXPENSES_ENDPOINTS = {
  list: '/expenses',
  expense: (id) => `/expenses/${encodeURIComponent(id)}`
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchExpenses = () => api(EXPENSES_ENDPOINTS.list)
export const createExpense = (payload) => api(EXPENSES_ENDPOINTS.list, { method: 'POST', body: payload })
export const destroyExpense = (id) => api(EXPENSES_ENDPOINTS.expense(id), { method: 'DELETE' })
