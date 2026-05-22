import { ACCOUNT_STATUSES, HttpError, ROLES, abort, audit, coversAllBranches, isUniqueViolation, roleLabel, statusLabel, transaction, validationError } from '../utils/index.js'
import { MODELS, modelNotFound, numericId } from '../utils/http.js'
import * as users from '../repositories/user.repository.js'
import { recordAccountChange, recordRoleChange } from '../repositories/accountHistory.repository.js'
import * as invitationService from './invitation.service.js'
import * as sessions from './session.service.js'
import { EMAIL_TAKEN, FIELDS } from '../models/account.model.js'

/**
 * Account Provision (Owner only): invite, edit, (de)activate and delete staff accounts (Laravel's AccountController
 * logic)
 */

/** Route-model binding: the account in the URL, or Laravel's 404 */
export async function findOrFail(id) {
  const userId = numericId(id)
  const account = userId === null ? null : await users.find(userId)
  if (!account) throw modelNotFound(MODELS.user, id)
  return account
}

// Database facts the form requests look up before validating (unique email, existing branch)
export const emailTaken = (email, ignoreId = null) => users.emailTaken(email, ignoreId)
export const branchExists = (id) => users.branchExists(id)

/** Every account with its branch and latest invitation, oldest first */
export const list = () => users.allWithDetails()

/** One account with its branch and latest invitation, for the response */
export const findWithDetails = (id) => users.findWithDetails(id)

function ensureEditable(req, account) {
  if (account.role === ROLES.OWNER) abort(403, "The Owner account can't be changed here.")
  if (account.id === req.user.id) abort(403, "You can't change the account you are signed in with.")
}

/** A save that lost the race for an email address gets the same message the validator gives */
async function guardEmailRace(fn) {
  try {
    return await fn()
  } catch (error) {
    if (isUniqueViolation(error, 'users_email_unique')) throw validationError({ email: EMAIL_TAKEN })
    throw error
  }
}

const isFilled = (value) => value !== undefined && value !== null && value !== '' && value !== false

/** Creates an invited account from validated input and emails the invitation; returns the users row */
export async function create(req, input) {
  const user = await guardEmailRace(() =>
    invitationService.withMail(() =>
      transaction(async (client) => {
        const created = await users.create(client, {
          fullName: input.fullName,
          email: input.email,
          role: input.role,
          branchId: coversAllBranches(input.role) ? null : input.branchId,
          status: ACCOUNT_STATUSES.INVITED,
        })
        await invitationService.send(client, created, req.user)
        return created
      }),
    ),
  )

  audit(req, {
    module: 'Accounts',
    action: 'Account invited',
    recordId: user.id,
    description: `${roleLabel(user.role)} account created for ${user.full_name} (${user.email}); invitation emailed.`,
    branchId: user.branch_id,
    after: user,
  })
  return user
}

/** Applies a validated edit to `account`; returns the response message */
export async function update(req, account, input) {
  ensureEditable(req, account)
  if (input.status !== undefined && input.status !== null && account.status === ACCOUNT_STATUSES.INVITED) {
    abort(422, "This account hasn't accepted its invitation yet, so it can't be activated or deactivated.")
  }

  const next = { ...account }
  for (const [column, key] of FIELDS) if (isFilled(input[key])) next[column] = input[key]
  // A role that covers every branch has no branch; the others must have one
  if (coversAllBranches(next.role)) next.branch_id = null
  else if (!next.branch_id) throw validationError({ branchId: 'Assign a branch for this role.' })

  const dirty = FIELDS.map(([column]) => column).filter((column) => (next[column] ?? null) !== (account[column] ?? null))

  // What changed, in words, for the audit log: each field before → after (a deleted branch shows as its id)
  const branchLabel = async (id) => (id ? ((await users.branchName(id)) ?? id) : 'all branches')
  const describe = {
    full_name: async () => `name ${account.full_name} → ${next.full_name}`,
    email: async () => `email ${account.email} → ${next.email}`,
    role: async () => `role ${roleLabel(account.role)} → ${roleLabel(next.role)}`,
    branch_id: async () => `branch ${await branchLabel(account.branch_id)} → ${await branchLabel(next.branch_id)}`,
    status: async () => `status ${statusLabel(account.status)} → ${statusLabel(next.status)}`,
  }
  const changed = (await Promise.all(dirty.map((column) => describe[column]()))).join(', ')

  const emailChanged = dirty.includes('email')
  const previousRole = dirty.includes('role') ? account.role : null
  // Kept for access reviews of past periods, like role changes
  const previousStatus = dirty.includes('status') ? account.status : null
  const branchChanged = dirty.includes('branch_id')
  const reinvite = emailChanged && next.status === ACCOUNT_STATUSES.INVITED

  await guardEmailRace(() =>
    invitationService.withMail(() =>
      transaction(async (client) => {
        await users.update(client, account.id, Object.fromEntries(dirty.map((column) => [column, next[column]])))

        // Kept for access reviews (privilege creep)
        if (previousRole) await recordRoleChange(client, account.id, previousRole, next.role, req.user.id)
        if (previousStatus) await recordAccountChange(client, account.id, 'status', previousStatus, next.status, req.user.id)
        if (branchChanged) await recordAccountChange(client, account.id, 'branch', account.branch_id, next.branch_id, req.user.id)

        // A reset link sent to the old address must stop working
        if (emailChanged) await users.forgetPasswordResets(client, account.email)
        // The old invitation went to the wrong address: replace it and email the new one
        if (reinvite) await invitationService.send(client, next, req.user)
      }),
    ),
  )

  // A deactivated user is signed out everywhere
  if (next.status === ACCOUNT_STATUSES.INACTIVE) await sessions.endAllFor(account.id, 'Account deactivated')

  const action = previousStatus
    ? next.status === ACCOUNT_STATUSES.INACTIVE
      ? 'Account deactivated'
      : 'Account activated'
    : previousRole
      ? 'Role changed'
      : 'Account updated'
  audit(req, {
    module: 'Accounts',
    action,
    recordId: account.id,
    description: `${next.full_name} (${next.email}): ${changed || 'no changes'}.`,
    branchId: next.branch_id,
    before: account,
    after: next,
  })

  let message = `${next.full_name}'s account was updated.`
  if (reinvite) message += ` A new invitation was sent to ${next.email}.`
  else if (emailChanged) message += ` They now sign in with ${next.email}.`
  return message
}

export async function remove(req, account) {
  ensureEditable(req, account)

  // auth-service deletes the sessions and tells their browsers; only then is the account removed, so a stopped
  // auth-service leaves everything as it was (Laravel did both in one transaction)
  await sessions.deleteAllFor(account.id, 'Account deleted')
  await transaction((client) => users.remove(client, account.id))

  audit(req, {
    module: 'Accounts',
    action: 'Account deleted',
    recordId: account.id,
    description: `${account.full_name} (${account.email}, ${roleLabel(account.role)}) was deleted.`,
    branchId: account.branch_id,
    type: 'delete',
    before: account,
  })
}

export async function resendInvitation(req, account) {
  if (account.status !== ACCOUNT_STATUSES.INVITED) throw new HttpError(422, 'This account has already been set up.')

  await invitationService.withMail(() => transaction((client) => invitationService.send(client, account, req.user)))
  audit(req, {
    module: 'Accounts',
    action: 'Invitation resent',
    recordId: account.id,
    description: `A new invitation was emailed to ${account.email}.`,
    branchId: account.branch_id,
  })
}
