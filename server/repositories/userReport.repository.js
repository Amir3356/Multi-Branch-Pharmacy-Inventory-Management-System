import { one, query } from '../utils/index.js'

/* The User Report's queries: accounts and their sign-in and change logs (user-service's tables, read only) */

export async function branchName(branchId) {
  return (await one('select name from branches where id = $1', [branchId]))?.name ?? null
}

export const invitations = () => query('select user_id, created_at, expires_at from account_invitations')

export const roleChangesBetween = (fromDb, asOfDb) =>
  query('select * from account_role_changes where changed_at between $1 and $2 order by changed_at', [fromDb, asOfDb])

export const lastSignIns = (asOfDb) =>
  query('select user_id, max(signed_in_at) as last_signed_in_at from account_sign_ins where signed_in_at <= $1 group by user_id', [asOfDb])

export const signInHistoryStart = () => one('select min(recorded_at) as first from account_sign_ins')

export const roleChangesAfter = (asOfDb) =>
  query('select user_id, from_role from account_role_changes where changed_at > $1 order by changed_at, id', [asOfDb])

/** Changes of one account field ('status', 'branch') after asOf, oldest first */
export const fieldChangesAfter = (field, asOfDb) =>
  query('select user_id, from_value from account_changes where field = $1 and changed_at > $2 order by changed_at, id', [field, asOfDb])

export const branches = () => query('select id, name from branches')

export const usersCreatedBy = (asOfDb) =>
  query('select id, full_name, email, role, branch_id, status, last_login_at, created_at from users where created_at <= $1 order by id', [asOfDb])
