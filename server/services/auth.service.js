import crypto from 'node:crypto'
import { ACCOUNT_STATUSES, abort, audit, config, hashPassword, logger, sendMail, unauthenticated, validationError, verifyPassword } from '../utils/index.js'
import { httpBuildQuery } from '../utils/httpBuildQuery.js'
import { RESET_THROTTLE_SECONDS } from '../models/passwordReset.model.js'
import { INACTIVITY_REASON } from '../models/session.model.js'
import { actorOf } from '../models/user.model.js'
import * as passwordResets from '../repositories/passwordReset.repository.js'
import * as sessionRecords from '../repositories/session.repository.js'
import * as users from '../repositories/user.repository.js'
import * as loginThrottle from './loginThrottle.service.js'
import { SessionService } from './session.service.js'
import * as tokens from './token.service.js'

/**
 * Signs in with email and password (input already validated by middleware/validators/auth.validator.js).
 * Returns { token, user }.
 */
export async function login(req, { email, password }) {
  const throttleKey = loginThrottle.throttleKey(email, req.clientIp)
  loginThrottle.ensureIsNotRateLimited(throttleKey)

  const user = await users.findByEmail(email)

  // Invited accounts have no password yet, so they fail here too
  if (!user?.password || !(await verifyPassword(password, user.password))) {
    loginThrottle.recordFailure(throttleKey)
    audit(req, {
      module: 'Sign-in',
      action: 'Failed sign-in',
      recordId: user ? String(user.id) : null,
      description: `Wrong email or password for ${email}.`,
      branchId: user?.branch_id ?? null,
      actor: actorOf(user),
      actorName: email,
    })
    throw validationError({ email: 'Invalid email or password.' })
  }

  if (user.status === ACCOUNT_STATUSES.INACTIVE) {
    audit(req, {
      module: 'Sign-in',
      action: 'Blocked sign-in',
      recordId: String(user.id),
      description: `${user.full_name} tried to sign in, but the account is deactivated.`,
      branchId: user.branch_id,
      actor: actorOf(user),
    })
    abort(403, 'This account has been deactivated. Contact the Owner.')
  }

  loginThrottle.clearFailures(throttleKey)
  await users.recordLogin(user.id)
  audit(req, {
    module: 'Sign-in',
    action: 'Signed in',
    recordId: String(user.id),
    description: `${user.full_name} (${user.email}) signed in.`,
    branchId: user.branch_id,
    actor: actorOf(user),
  })

  return tokens.issue(user.id, req, new SessionService())
}

/**
 * Emails a reset link. Tells the person exactly what happened, so they know whether to check their inbox.
 * Returns the success message.
 */
export async function forgotPassword(req, email) {
  const user = await users.findByEmail(email)
  const problem = !user
    ? "We couldn't find an account with that email address. Check the spelling, or ask the Owner which email your account uses."
    : user.status === ACCOUNT_STATUSES.INVITED
      ? "This account hasn't been set up yet. Use the invitation link in your email to choose a password, or ask the Owner to resend it."
      : user.status === ACCOUNT_STATUSES.INACTIVE
        ? "This account has been deactivated, so its password can't be reset. Contact the Owner."
        : null
  if (problem) throw validationError({ email: problem })

  // Laravel's password broker allows one reset email per account per minute
  const existing = await passwordResets.find(user.email)
  if (existing?.created_at && new Date(existing.created_at).getTime() + RESET_THROTTLE_SECONDS * 1000 > Date.now()) {
    abort(429, `A reset link was sent to ${email} less than a minute ago. Check your inbox and spam folder, or wait a minute and try again.`)
  }

  // The broker's token: 64 hex characters, stored only as a bcrypt hash
  const token = crypto.randomBytes(32).toString('hex')
  await passwordResets.create(user.email, await hashPassword(token))

  try {
    await sendMail('reset-password', user.email, {
      fullName: user.full_name,
      link: `${config.frontendUrl}/reset-password?${httpBuildQuery({ token, email: user.email })}`,
      expiresInMinutes: config.passwordResetExpireMinutes,
    })
  } catch (error) {
    logger.error('Password reset email failed', { email, error: error.message })
    abort(503, "The reset email couldn't be sent right now. Try again in a few minutes.")
  }

  const minutes = config.passwordResetExpireMinutes
  const requester = await users.findByEmail(email)
  audit(req, {
    module: 'Sign-in',
    action: 'Password reset requested',
    recordId: requester ? String(requester.id) : null,
    description: `A reset link was emailed to ${email}.`,
    branchId: requester?.branch_id ?? null,
    actor: actorOf(requester),
  })

  return `We sent a password reset link to ${email}. It expires in ${minutes} minutes; if you don't see it, check your spam folder.`
}

/**
 * Sets the new password, signs out every old session, and signs this browser straight in.
 * Returns { token, user } for the fresh session.
 */
export async function resetPassword(req, input) {
  // Password::reset: the account must exist and the token match an unexpired row for its email
  const user = await users.findByEmail(input.email)
  const record = user ? await passwordResets.find(user.email) : null
  const valid =
    record !== null &&
    record.created_at !== null &&
    new Date(record.created_at).getTime() + config.passwordResetExpireMinutes * 60_000 > Date.now() &&
    (await verifyPassword(input.token, record.token))
  if (!valid) abort(422, 'This password reset link is invalid or has expired. Request a new one.')

  const sessions = new SessionService()
  await users.setPassword(user.id, await hashPassword(input.password))
  // Sign out every device that used the old password
  await sessions.endAllFor(user.id, 'Password reset')
  await passwordResets.remove(user.email)

  audit(req, {
    module: 'Sign-in',
    action: 'Password reset',
    recordId: String(user.id),
    description: `${user.full_name} (${user.email}) set a new password; every other session was signed out.`,
    branchId: user.branch_id,
    actor: actorOf(user),
  })

  // A fresh session for this browser, like accepting an invitation
  return tokens.issue(user.id, req, sessions)
}

/** The signed-in user's row with its branch name, or 401 if the account no longer exists */
export async function currentUser(userId) {
  const user = await users.withBranch(userId)
  if (!user) throw unauthenticated()
  return user
}

/** Ends this browser's session. `reason` is the request's reason; the browser's inactivity timer sends "inactivity". */
export async function logout(req, reason) {
  const endReason = reason === 'inactivity' ? INACTIVITY_REASON : 'Signed out'
  if (req.tokenId) {
    const token = await sessionRecords.find(req.tokenId)
    if (token) {
      await new SessionService().end(token, endReason)
    }
  }

  if (req.user) {
    const signedOut = endReason === 'Signed out'
    audit(req, {
      module: 'Sign-in',
      action: signedOut ? 'Signed out' : 'Signed out (inactive)',
      recordId: String(req.user.id),
      description: (req.user.fullName || req.user.full_name || 'User') + (signedOut ? ' signed out.' : ' was signed out after a period of inactivity.'),
      branchId: req.user.branchId ?? req.user.branch_id ?? null,
    })
  }
}
