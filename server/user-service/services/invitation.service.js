import crypto from 'node:crypto'
import { ACCOUNT_STATUSES, HttpError, audit, config, hashPassword, logger, roleLabel, sendMail, serviceClient, transaction } from '../utils/index.js'
import * as invitations from '../repositories/invitation.repository.js'
import * as users from '../repositories/user.repository.js'
import { recordAccountChange } from '../repositories/accountHistory.repository.js'

// Opening the session after an invitation is accepted belongs to auth-service
const auth = serviceClient('auth')

/** An invitation email that couldn't be sent; withMail turns it into the 503 Laravel sent */
export class InvitationMailFailed extends Error {}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

/** Laravel's Str::random(64): letters and digits from a CSPRNG */
function randomToken(length = 64) {
  let token = ''
  while (token.length < length) token += crypto.randomBytes(length).toString('base64').replace(/[+/=]/g, '')
  return token.slice(0, length)
}

/** "10 minutes", "2 hours", "3 days": how long the link works, for the email */
export function duration(minutes) {
  const [amount, unit] = minutes % 1440 === 0 ? [minutes / 1440, 'day'] : minutes % 60 === 0 ? [minutes / 60, 'hour'] : [minutes, 'minute']
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`
}

/**
 * Replaces any earlier invitation for the user and emails a fresh link. Runs inside the caller's transaction, so a
 * failed send rolls everything back. `user` is a users row; `invitedBy` is req.user (or null).
 */
export async function send(client, user, invitedBy) {
  const token = randomToken()
  const minutes = Math.max(1, config.invitationExpireMinutes)

  await invitations.replaceFor(client, user.id, invitedBy?.id ?? null, sha256(token), minutes)

  const link = `${config.frontendUrl}/accept-invitation?token=${encodeURIComponent(token)}`
  const branchName = user.branch_id ? await users.branchName(user.branch_id, client) : null
  try {
    await sendMail('invitation', user.email, { fullName: user.full_name, roleLabel: roleLabel(user.role), branchName, link, expiresIn: duration(minutes) })
  } catch (error) {
    throw new InvitationMailFailed(error.message)
  }
}

/** Runs fn; an invitation email that couldn't be sent becomes a clear 503 instead of a bare 500 (nothing was saved) */
export async function withMail(fn) {
  try {
    return await fn()
  } catch (error) {
    if (!(error instanceof InvitationMailFailed)) throw error
    logger.error('Invitation email failed', { error: error.message })
    throw new HttpError(503, "The invitation email couldn't be sent, so nothing was saved. Check the mail settings and try again.")
  }
}

/** The pending invitation for a raw token from the link (with its user), or null if unknown or already used */
export async function find(token) {
  const invitation = await invitations.findByTokenHash(sha256(String(token)))
  return invitation?.status === ACCOUNT_STATUSES.INVITED ? invitation : null
}

/** Sets the password, activates the account and uses up the invitation; returns the users row */
export async function accept(invitation, password) {
  // bcrypt is slow on purpose: hash before the transaction opens
  const passwordHash = await hashPassword(password)
  return transaction(async (client) => {
    // Locked, so two clicks on the same link can't both activate it
    const user = await users.find(invitation.user_id, client, { forUpdate: true })
    if (user?.status !== ACCOUNT_STATUSES.INVITED) throw new HttpError(404, 'This invitation link is invalid or has already been used.')
    await users.activate(client, user.id, passwordHash)
    // Pending → Active, kept for access reviews of past periods
    await recordAccountChange(client, user.id, 'status', ACCOUNT_STATUSES.INVITED, ACCOUNT_STATUSES.ACTIVE, user.id)
    await invitations.deleteFor(client, user.id)
    return { ...user, status: ACCOUNT_STATUSES.ACTIVE }
  })
}

/** The invitation for a token from the link, or 404 (unknown / used) or 410 (expired) */
export async function usable(token) {
  const invitation = await find(token)
  if (!invitation) throw new HttpError(404, 'This invitation link is invalid or has already been used.')
  if (invitation.expires_at.getTime() < Date.now()) throw new HttpError(410, 'This invitation link has expired. Ask the Owner to resend it.')
  return invitation
}

/**
 * Accepts the invitation behind `token` with an already validated password, then has auth-service open the session
 * and record the sign-in; returns its body, exactly a successful login's ({ token, user }).
 */
export async function acceptAndSignIn(req, token, password) {
  const user = await accept(await usable(token), password)
  audit(req, {
    module: 'Accounts',
    action: 'Invitation accepted',
    recordId: user.id,
    description: `${user.full_name} (${user.email}) set a password and signed in for the first time.`,
    branchId: user.branch_id,
    // Not signed in yet: the person who accepted is the actor
    actor: { id: user.id, fullName: user.full_name, role: user.role },
    type: 'approve',
    before: { status: ACCOUNT_STATUSES.INVITED },
    after: { status: user.status },
  })

  return auth.post('/internal/auth/issue-token', { userId: user.id }, { req })
}
