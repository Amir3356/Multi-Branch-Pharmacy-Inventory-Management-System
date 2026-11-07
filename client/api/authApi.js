import { api } from '../utils/http'
import { toNewPasswordPayload, toResetPasswordPayload } from '../features/auth/model/authUser'

// Sign-in, invitation and password reset endpoints
export const AUTH_ENDPOINTS = {
  login: '/auth/login',
  logout: '/auth/logout',
  me: '/auth/me',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  invitation: (token) => `/invitations/${encodeURIComponent(token)}`,
  acceptInvitation: (token) => `/invitations/${encodeURIComponent(token)}/accept`
}

// Each call returns the API's JSON; failures throw ApiError
export const login = (email, password) => api(AUTH_ENDPOINTS.login, { method: 'POST', body: { email, password } })
export const logout = (body) => api(AUTH_ENDPOINTS.logout, { method: 'POST', body })
export const fetchCurrentUser = () => api(AUTH_ENDPOINTS.me)
export const fetchInvitationByToken = (token) => api(AUTH_ENDPOINTS.invitation(token))
export const acceptInvitationRequest = (token, password, passwordConfirmation) =>
  api(AUTH_ENDPOINTS.acceptInvitation(token), { method: 'POST', body: toNewPasswordPayload(password, passwordConfirmation) })
export const forgotPassword = (email) => api(AUTH_ENDPOINTS.forgotPassword, { method: 'POST', body: { email } })
export const resetPasswordRequest = (data) =>
  api(AUTH_ENDPOINTS.resetPassword, { method: 'POST', body: toResetPasswordPayload(data) })
