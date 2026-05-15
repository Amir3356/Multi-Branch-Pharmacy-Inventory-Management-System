import { introspect } from '../services/introspection.service.js'
import { AUTH_COOKIE_NAME } from '../utils/tokens.js'
import { clientIpOf } from '../utils/clientIp.js'

/**
 * Extracts JWT from HTTP-only cookie first (protecting against XSS),
 * with fallback to the Authorization Bearer header, introspects it,
 * and sets req.user, req.tokenId, req.clientIp, and req.userAgent.
 */
export async function authenticate(req, res, next) {
  // Never read X-Forwarded-For directly: anyone can send it. req.ip honours it only from TRUSTED_PROXIES.
  req.clientIp = clientIpOf(req)
  req.userAgent = req.get('user-agent') || null
  req.user = null
  req.tokenId = null

  // 1. Check HTTP-Only Cookie first (secure against XSS)
  let token = req.cookies?.[AUTH_COOKIE_NAME]

  // 2. Fall back to Authorization Header (for API tools, mobile clients, scripts)
  if (!token && req.headers.authorization) {
    const match = req.headers.authorization.match(/^Bearer\s+(.+)$/i)
    if (match) token = match[1].trim()
  }

  if (token) {
    try {
      const result = await introspect({ token, ip: req.clientIp, touch: true })
      if (result?.user) {
        req.user = result.user
        req.tokenId = result.tokenId
      }
    } catch {
      // Leave req.user as null; requireAuth middleware will handle rejection
    }
  }

  next()
}

export default authenticate
