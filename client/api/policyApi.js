import { api } from '../utils/http'

// The store's policy, shared by every user and branch
export const POLICY_ENDPOINTS = { policy: '/policy' }

// Each call returns the API's JSON; failures throw ApiError
export const fetchPolicy = () => api(POLICY_ENDPOINTS.policy)
export const updatePolicy = (payload) => api(POLICY_ENDPOINTS.policy, { method: 'PUT', body: payload })
