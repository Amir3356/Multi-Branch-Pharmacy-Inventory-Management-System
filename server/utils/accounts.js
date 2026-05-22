import { config } from '../config/index.js'
import { coversAllBranches, homeSectionFor, roleLabel, sectionsFor, statusLabel } from './roles.js'
import { iso8601 } from './time.js'

/**
 * Account payloads, shared by auth-service (sign-in, /auth/me) and user-service (Account Provision), so both send
 * exactly what Laravel's AccountResource / AuthUserResource sent.
 *
 * `user` is a users row (snake_case columns) plus `branch_name` when joined. Pass `invitationExpired` (boolean) only
 * when the invitation was looked up; it is included for invited accounts only, as before.
 */
export function presentAccount(user, { invitationExpired } = {}) {
  const allBranches = coversAllBranches(user.role)
  const account = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    roleLabel: roleLabel(user.role),
    // Those who cover every branch (Owner, Purchase Officer)
    branchId: allBranches ? 'all' : user.branch_id,
    branchName: allBranches ? 'All Branches' : (user.branch_name ?? null),
    status: statusLabel(user.status),
  }
  if (user.status === 'invited' && invitationExpired !== undefined) account.invitationExpired = invitationExpired
  account.lastLoginAt = iso8601(user.last_login_at)
  account.createdAt = iso8601(user.created_at)
  return account
}

/** The signed-in user plus what their role may open; the client builds the sidebar from `sections` */
export function presentAuthUser(user) {
  return {
    ...presentAccount(user),
    sections: sectionsFor(user.role),
    homeSection: homeSectionFor(user.role),
    // The browser signs out after this many minutes without use (0 = never)
    sessionTimeoutMinutes: config.sessionTimeoutMinutes,
    // Whether the browser should ask for its location after sign-in
    askDeviceLocation: config.deviceLocation,
  }
}

/** The identity the gateway forwards to every service as req.user (see context.js) */
export function toUserContext(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    roleLabel: roleLabel(user.role),
    status: user.status,
    branchId: user.branch_id ?? null,
    coversAllBranches: coversAllBranches(user.role),
    isOwner: user.role === 'owner',
  }
}

/** select … from users left join branches: the columns presentAccount needs */
export const ACCOUNT_COLUMNS = 'u.id, u.full_name, u.email, u.role, u.branch_id, u.status, u.last_login_at, u.created_at, u.updated_at, b.name as branch_name'
