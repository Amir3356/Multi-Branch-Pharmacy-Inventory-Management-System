import { abort, config } from '../utils/index.js'
import { rawurlencode } from '../utils/php.js'

/**
 * Chapa's hosted checkout (https://developer.chapa.co): initialize a transaction, send the person to its checkout_url,
 * then verify it by tx_ref. Never trust a callback or return URL alone; always verify.
 */

async function send(method, path, body) {
  const secret = config.chapa.secretKey
  if (!secret) abort(503, 'Chapa payments are not configured. Set CHAPA_SECRET_KEY in the server .env file.')

  let response
  try {
    response = await fetch(`${config.chapa.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    abort(502, "Can't reach Chapa right now. Try again in a moment.")
  }
  // Like Laravel's $response->json(): null when the body isn't JSON
  const json = await response.json().catch(() => null)
  return { status: response.status, ok: response.status >= 200 && response.status < 300, json }
}

// Chapa sends either a sentence or a { field: [messages] } object in "message"
function errorMessage({ status, json }) {
  let message = json?.message
  if (message && typeof message === 'object') {
    const flatten = (value) => (value && typeof value === 'object' ? Object.values(value).flatMap(flatten) : [value])
    message = flatten(message).join(' ')
  }
  return message || `unexpected response (${status}).`
}

export const chapaClient = {
  /** Starts a checkout and returns the URL to send the person to */
  async initialize(payload) {
    const response = await send('POST', '/transaction/initialize', payload)
    const checkoutUrl = response.json?.data?.checkout_url
    if (!response.ok || response.json?.status !== 'success' || !checkoutUrl) {
      abort(502, `Chapa could not start the payment: ${errorMessage(response)}`)
    }
    return checkoutUrl
  },

  /** The transaction as Chapa sees it ("data" of the verify response), or null if Chapa doesn't know it yet */
  async verify(txRef) {
    const response = await send('GET', `/transaction/verify/${rawurlencode(txRef)}`)
    if (response.status === 404 || response.status === 400) return null
    if (!response.ok) abort(502, `Chapa could not verify the payment: ${errorMessage(response)}`)
    return response.json?.data ?? null
  },
}
