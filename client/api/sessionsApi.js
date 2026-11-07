import { api } from '../utils/http'

// Session Monitoring endpoints (Owner only)
export const SESSIONS_ENDPOINTS = {
  list: '/sessions',
  session: (id) => `/sessions/${id}`,
  end: (id) => `/sessions/${id}/end`,
  currentLocation: '/sessions/current/location'
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchSessions = () => api(SESSIONS_ENDPOINTS.list)
export const endSessionRequest = (id) => api(SESSIONS_ENDPOINTS.end(id), { method: 'POST' })
export const destroySession = (id) => api(SESSIONS_ENDPOINTS.session(id), { method: 'DELETE' })
// Any signed-in user: where this browser is being used, if the person allowed it
export const reportDeviceLocation = (position) => api(SESSIONS_ENDPOINTS.currentLocation, { method: 'POST', body: position })
