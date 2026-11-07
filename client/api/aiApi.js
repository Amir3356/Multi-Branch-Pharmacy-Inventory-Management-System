import { api } from '../utils/http'

// AI Assistance: questions answered by the server from the data the signed-in role can see
export const AI_ENDPOINTS = {
  chat: '/ai/chat'
}

// A little longer than the server's OPENROUTER_TIMEOUT (60 s), so the server's own error message arrives first
const AI_TIMEOUT_MS = 75000

// Each call returns the API's JSON; failures throw ApiError
export const askAssistant = (messages) => api(AI_ENDPOINTS.chat, { method: 'POST', body: { messages }, timeoutMs: AI_TIMEOUT_MS })
