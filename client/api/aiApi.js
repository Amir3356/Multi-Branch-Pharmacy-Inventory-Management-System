import { api } from '../utils/http'

// AI Assistance: questions answered by the server from the data the signed-in role can see
export const AI_ENDPOINTS = {
  chat: '/ai/chat',
  recommendations: '/ai/recommendations'
}

// A little longer than the server's GEMINI_TIMEOUT (90 s), so the server's own error message arrives first
const AI_TIMEOUT_MS = 105000

/**
 * The Owner's analysis scope, sent with each AI call: { from, to, branchId } — the dashboard's period and branch
 * ('all' = every branch). Other roles send none; the server ignores it for them.
 */
const scopeFields = (scope) => (scope ? { from: scope.from, to: scope.to, branchId: scope.branchId || 'all' } : {})

// Each call returns the API's JSON; failures throw ApiError
export const askAssistant = (messages, scope) =>
  api(AI_ENDPOINTS.chat, { method: 'POST', body: { messages, ...scopeFields(scope) }, timeoutMs: AI_TIMEOUT_MS })

// { summary, recommendations, flags, scope, generatedAt, cached }; refresh skips the server's 30-minute cache
export const fetchAdvice = (scope, { refresh = false } = {}) => {
  const params = new URLSearchParams({ ...scopeFields(scope), ...(refresh ? { refresh: '1' } : {}) })
  return api(`${AI_ENDPOINTS.recommendations}?${params}`, { timeoutMs: AI_TIMEOUT_MS })
}
