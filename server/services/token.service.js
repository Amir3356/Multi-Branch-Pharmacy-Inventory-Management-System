import { limit, notFound, presentAuthUser } from '../utils/index.js'
import * as sessionRecords from '../repositories/session.repository.js'
import * as signIns from '../repositories/signIn.repository.js'
import * as users from '../repositories/user.repository.js'
import { generateToken, randomString, sha256 } from '../utils/tokens.js'
import { SessionService } from './session.service.js'

/**
 * Issues a new JWT authentication token and returns { token, user }.
 */
export async function issue(userId, req, sessions = new SessionService()) {
  const device = limit(req?.userAgent || 'Unknown device', 120, '')
  const user = await users.withBranch(userId)
  if (!user) throw notFound()

  // Track the sign-in session for access review and monitoring
  const secretKey = randomString(32)
  const session = await sessionRecords.createFor(userId, device, sha256(secretKey))
  await signIns.record(userId)

  if (sessions && req?.clientIp) {
    await sessions.recordAddress(session, req.clientIp)
    sessions.announce('signed-in')
  }

  // Issue standard JWT with user claims and session ID
  const token = generateToken(user, { sessionId: session.id })

  return {
    token,
    user: presentAuthUser(user),
  }
}

/** Signs a user in right after another action proved who they are */
export async function issueFor(userId, req) {
  if (!(await users.find(userId))) throw notFound()
  return issue(userId, req, new SessionService())
}
