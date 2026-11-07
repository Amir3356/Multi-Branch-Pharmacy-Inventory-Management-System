import { HEADERS, decodeContext, isInternalSecret } from '../utils/context.js'
import { HttpError } from '../utils/errors.js'
import { introspect } from '../services/introspection.service.js'

/**
 * Refuses anything that did not come through the gateway or another service, then puts the caller on the request:
 * req.user, req.tokenId, req.clientIp, req.userAgent. Applied to every route by utils/server.js.
 */
export async function internalOnly(req, res, next) {
  if (!isInternalSecret(req.get(HEADERS.SECRET))) {
    return next(new HttpError(403, 'Requests must go through the API gateway.'))
  }
  const context = decodeContext(req.get(HEADERS.CONTEXT))
  req.user = context?.user ?? null
  req.tokenId = context?.tokenId ?? null
  req.clientIp = req.get(HEADERS.CLIENT_IP) || req.socket.remoteAddress || null
  req.userAgent = req.get('user-agent') || null

  // When behind a reverse proxy (like Nginx) that forwards the Bearer token directly:
  if (!req.user && req.headers.authorization) {
    const match = req.headers.authorization.match(/^Bearer\s+(.+)$/i)
    const token = match ? match[1].trim() : null
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
  }

  next()
}
