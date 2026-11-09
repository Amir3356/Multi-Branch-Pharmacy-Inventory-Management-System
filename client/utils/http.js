// Thin fetch wrapper for the API gateway. Every call returns parsed JSON or throws ApiError.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, fieldErrors = {}) {
    super(message)
    this.status = status
    // First message per field, e.g. { email: 'Another account already uses this email.' }
    this.fieldErrors = fieldErrors
  }
}

let authToken = null
let unauthorizedHandler = null

export const setAuthToken = (token) => {
  authToken = token
}

// The live-updates connection signs in with the same token
export const getAuthToken = () => authToken

// Called when a signed-in request comes back 401 (token expired or revoked)
export const onUnauthorized = (handler) => {
  unauthorizedHandler = handler
}

// `headers` adds request headers, e.g. { 'Idempotency-Key': … } so a retried POST can't record the same thing twice.
// `timeoutMs` gives up waiting after that long (a slow or dropped connection) instead of hanging.
export async function api(path, { method = 'GET', body, headers: extraHeaders, timeoutMs } = {}) {
  const headers = { Accept: 'application/json', ...extraHeaders }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
      credentials: 'include',
    })
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new ApiError('No answer from the server. The connection is slow or dropped.', 0)
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && authToken) unauthorizedHandler?.()
    const fieldErrors = Object.fromEntries(Object.entries(data.errors || {}).map(([field, messages]) => [field, messages[0]]))
    throw new ApiError(data.message || 'Something went wrong. Try again.', response.status, fieldErrors)
  }
  return data
}
