import crypto from 'node:crypto'
import { config } from './config.js'

/**
 * How identity travels between services.
 *
 * The API gateway authenticates each request (asks auth-service about the bearer token), then forwards it with:
 *   x-internal-secret  proves the request came from the gateway or another service
 *   x-auth-context     base64url JSON { user, tokenId } for a signed-in request; absent for guests
 *   x-client-ip        the visitor's IP as the gateway saw it (honouring TRUSTED_PROXIES)
 *   user-agent         passed through unchanged
 *
 * The signed-in user, as every service sees it (req.user, set by middleware/internalOnly.js):
 *   { id, fullName, email, role, roleLabel, status, branchId, coversAllBranches, isOwner }
 */
export const HEADERS = Object.freeze({
  SECRET: 'x-internal-secret',
  CONTEXT: 'x-auth-context',
  CLIENT_IP: 'x-client-ip',
})

export const encodeContext = (context) => Buffer.from(JSON.stringify(context)).toString('base64url')

export function decodeContext(value) {
  if (!value) return null
  try {
    return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export function isInternalSecret(value) {
  if (typeof value !== 'string') return false
  const a = Buffer.from(value)
  const b = Buffer.from(config.internalSecret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** The headers to forward the current caller to another service */
export function forwardHeaders(req) {
  if (!req) return {}
  const headers = {}
  const context = req.get?.(HEADERS.CONTEXT)
  if (context) headers[HEADERS.CONTEXT] = context
  if (req.clientIp) headers[HEADERS.CLIENT_IP] = req.clientIp
  if (req.userAgent) headers['user-agent'] = req.userAgent
  return headers
}
