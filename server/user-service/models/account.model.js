import { ACCOUNT_STATUSES, presentAccount } from '../utils/index.js'

/**
 * Account: a staff member's row of the users table (Laravel's User model) and its JSON shape (AccountResource).
 * The shared account payload (presentAccount, ACCOUNT_COLUMNS) lives in utils/accounts.js.
 */

export const EMAIL_TAKEN = 'Another account already uses this email.'

// The columns an edit can change, in the users table's column order (the order Laravel listed changes in)
export const FIELDS = [
  ['full_name', 'fullName'],
  ['email', 'email'],
  ['role', 'role'],
  ['branch_id', 'branchId'],
  ['status', 'status'],
]

/**
 * AccountResource for a row from users.allWithDetails / findWithDetails: the latest invitation was loaded, so invited
 * accounts say whether their link has expired (no invitation at all counts as expired).
 */
export function presentAccountWithDetails(row) {
  const invitationExpired =
    row.status === ACCOUNT_STATUSES.INVITED ? !row.invitation_expires_at || row.invitation_expires_at.getTime() < Date.now() : undefined
  return presentAccount(row, { invitationExpired })
}
