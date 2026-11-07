import { api } from '../utils/http'

// Staff accounts endpoints (Owner only)
export const ACCOUNTS_ENDPOINTS = {
  list: '/accounts',
  account: (id) => `/accounts/${id}`,
  resendInvitation: (id) => `/accounts/${id}/resend-invitation`
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchAccounts = () => api(ACCOUNTS_ENDPOINTS.list)
export const createAccount = (data) => api(ACCOUNTS_ENDPOINTS.list, { method: 'POST', body: data })
export const updateAccount = (id, changes) => api(ACCOUNTS_ENDPOINTS.account(id), { method: 'PATCH', body: changes })
export const resendAccountInvitation = (id) => api(ACCOUNTS_ENDPOINTS.resendInvitation(id), { method: 'POST' })
export const destroyAccount = (id) => api(ACCOUNTS_ENDPOINTS.account(id), { method: 'DELETE' })
