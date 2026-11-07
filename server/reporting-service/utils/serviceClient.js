import { config } from './config.js'
import { HEADERS, forwardHeaders } from './context.js'
import { HttpError } from './errors.js'

/**
 * Calls another service's internal API. Errors from the other service come back as HttpError with its status and
 * body, so a 422 from inventory-service ("Only 3 units left…") reaches the browser unchanged.
 *
 *   const inventory = serviceClient('inventory')
 *   await inventory.post('/internal/stock/take', body, { req })   // req forwards the signed-in user
 */
export function serviceClient(name) {
  const baseUrl = config.services[name]
  if (!baseUrl) throw new Error(`Unknown service "${name}"`)

  async function request(method, path, { body, req, timeoutMs = 10_000, headers = {} } = {}) {
    let response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          [HEADERS.SECRET]: config.internalSecret,
          ...forwardHeaders(req),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new HttpError(503, `The ${name} service is unavailable right now. Try again shortly.`, undefined, { cause: error.name })
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new HttpError(response.status, data.message || `The ${name} service could not complete the request.`, data.errors)
    }
    return data
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, body, options) => request('POST', path, { ...options, body }),
    put: (path, body, options) => request('PUT', path, { ...options, body }),
    patch: (path, body, options) => request('PATCH', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),
  }
}
