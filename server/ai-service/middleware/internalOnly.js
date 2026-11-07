import { HEADERS, decodeContext, isInternalSecret } from '../utils/context.js'
import { HttpError } from '../utils/errors.js'

/**
 * Refuses anything that did not come through the gateway or another service, then puts the caller on the request:
 * req.user, req.tokenId, req.clientIp, req.userAgent. Applied to every route by utils/server.js.
 */
export function internalOnly(req, res, next) {
  if (!isInternalSecret(req.get(HEADERS.SECRET))) {
    return next(new HttpError(403, 'Requests must go through the API gateway.'))
  }
  const context = decodeContext(req.get(HEADERS.CONTEXT))
  req.user = context?.user ?? null
  req.tokenId = context?.tokenId ?? null
  req.clientIp = req.get(HEADERS.CLIENT_IP) || req.socket.remoteAddress || null
  req.userAgent = req.get('user-agent') || null
  next()
}
