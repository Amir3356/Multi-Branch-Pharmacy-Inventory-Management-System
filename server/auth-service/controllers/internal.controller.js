import { HEADERS, encodeContext } from '../utils/index.js'
import { introspect as introspectToken } from '../services/introspection.service.js'
import * as sessions from '../services/session.service.js'
import * as tokens from '../services/token.service.js'

/**
 * Service-to-service (never routed by the gateway):
 *   POST /internal/auth/introspect     { token, ip?, userAgent?, touch } → { user, tokenId } | { user: null }
 *   POST /internal/auth/issue-token    { userId } (forwarded req)        → { token, user }
 *   POST /internal/sessions/end-all    { userId, reason }                → { ended }
 *   POST /internal/sessions/delete-all { userId, reason }                → { deleted }
 * Bodies of the last three are parsed by middleware/validators/internal.validator.js.
 */

export async function introspect(req, res) {
  const body = req.body ?? {}
  if (typeof body.token !== 'string' || body.token === '') return res.json({ user: null })

  const result = await introspectToken({
    token: body.token,
    ip: typeof body.ip === 'string' && body.ip !== '' ? body.ip : null,
    touch: body.touch === true,
  })
  res.json(result ?? { user: null })
}

/**
 * GET /internal/auth/gateway-check: the nginx gateway's auth_request. nginx sends the browser's Authorization header
 * and IP; the answer is always 204 (guests pass too: each service decides whether a route needs sign-in), with
 * x-auth-context set to the signed-in user when the bearer token is valid. nginx forwards that header to the service.
 */
export async function gatewayCheck(req, res) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '')
  if (match) {
    const result = await introspectToken({ token: match[1].trim(), ip: req.clientIp, touch: true })
    if (result?.user) res.set(HEADERS.CONTEXT, encodeContext({ user: result.user, tokenId: result.tokenId }))
  }
  res.status(204).end()
}

/** Signs a user in right after another service proved who they are (an accepted invitation) */
export async function issueToken(req, res) {
  res.json(await tokens.issueFor(req.body.userId, req))
}

/** Ends every open session of the user (account deactivated), tells their browsers and refreshes the Owner's list */
export async function endAllSessions(req, res) {
  res.json({ ended: await sessions.endAllFor(req.body.userId, req.body.reason) })
}

/** Same, but removes the rows (account deleted) */
export async function deleteAllSessions(req, res) {
  res.json({ deleted: await sessions.deleteAllFor(req.body.userId, req.body.reason) })
}
