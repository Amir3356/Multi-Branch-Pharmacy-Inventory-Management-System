import { toUserContext } from '../utils/index.js'
import * as repository from '../repositories/session.repository.js'
import * as users from '../repositories/user.repository.js'
import { SessionService } from './session.service.js'
import { verifyToken } from '../utils/tokens.js'

/**
 * Validates a JWT Bearer token and returns { user, tokenId } or null.
 *
 * Verifies JWT signature and expiry. If the JWT contains a sessionId, it checks
 * that the session hasn't been explicitly ended or timed out due to inactivity.
 */
export async function introspect({ token, ip = null, touch = false }) {
  if (!token || typeof token !== 'string') return null

  let decoded
  try {
    decoded = verifyToken(token)
  } catch {
    return null
  }

  if (!decoded?.id) return null

  const user = await users.find(decoded.id)
  if (!user || user.status !== 'active') return null

  // If session tracking is attached, check session validity
  const sessionId = decoded.sessionId
  if (sessionId) {
    const session = await repository.find(sessionId)
    if (session) {
      if (session.ended_at !== null) return null

      const sessions = new SessionService()
      if (await sessions.expireIfInactive(session)) return null

      if (touch) {
        await sessions.recordActivity(session, ip)
        await repository.touch(session.id)
      }
    }
  }

  return { user: toUserContext(user), tokenId: sessionId ?? null }
}
