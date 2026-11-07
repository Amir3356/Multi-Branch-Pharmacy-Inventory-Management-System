import { config, toUserContext } from '../utils/index.js'
import * as repository from '../repositories/session.repository.js'
import * as users from '../repositories/user.repository.js'
import { SessionService } from './session.service.js'
import { TOKENABLE_TYPE } from '../models/session.model.js'
import { hashEquals, parseToken, sha256 } from '../utils/tokens.js'

/** Sanctum's PersonalAccessToken::findToken: by id and a timing-safe hash compare, or by hash for a token without "|" */
async function findToken(plain) {
  const parsed = parseToken(plain)
  if (!parsed) return null
  if (parsed.id === null) return repository.findByHash(sha256(parsed.secret))

  const token = await repository.find(parsed.id)
  return token && hashEquals(token.token, sha256(parsed.secret)) ? token : null
}

/**
 * Who a bearer token belongs to, checked as Sanctum's guard plus AppServiceProvider did:
 *   - not past TOKEN_EXPIRATION_MINUTES since it was created, nor past its expires_at, and its user exists
 *   - not ended, and not unused past SESSION_TIMEOUT_MINUTES (then it is ended, with the inactivity reason)
 * With touch (a real API request), the request counts as activity: the IP/location are recorded (TokenAuthenticated)
 * and last_used_at is stamped.
 *
 * Returns { user, tokenId } or null.
 */
export async function introspect({ token: plain, ip = null, touch = false }) {
  const token = await findToken(plain)
  if (!token) return null

  const user = token.tokenable_type === TOKENABLE_TYPE ? await users.find(token.tokenable_id) : null
  const minutes = config.tokenExpirationMinutes
  const isValid =
    (!minutes || new Date(token.created_at).getTime() > Date.now() - minutes * 60_000) &&
    (!token.expires_at || new Date(token.expires_at).getTime() > Date.now()) &&
    user !== null
  if (!isValid || token.ended_at !== null) return null

  const sessions = new SessionService()
  if (await sessions.expireIfInactive(token)) return null

  if (touch) {
    await sessions.recordActivity(token, ip)
    await repository.touch(token.id)
  }

  return { user: toUserContext(user), tokenId: token.id }
}
