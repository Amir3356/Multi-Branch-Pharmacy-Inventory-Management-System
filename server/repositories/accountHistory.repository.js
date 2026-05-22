import { one, pool, query } from '../utils/index.js'

/**
 * Role changes, status/branch changes and sign-ins, kept so access reviews of a past period show each account as it
 * was then (Laravel's RoleChangeRepository, AccountChangeRepository and the read side of SignInRepository; sign-ins
 * are written by auth-service).
 */

export function recordRoleChange(client, userId, fromRole, toRole, changedBy) {
  return client.query('insert into account_role_changes (user_id, from_role, to_role, changed_by, changed_at) values ($1, $2, $3, $4, now())', [
    userId,
    fromRole,
    toRole,
    changedBy,
  ])
}

/** field: 'status' | 'branch' */
export function recordAccountChange(client, userId, field, fromValue, toValue, changedBy) {
  return client.query('insert into account_changes (user_id, field, from_value, to_value, changed_by, changed_at) values ($1, $2, $3, $4, $5, now())', [
    userId,
    field,
    fromValue,
    toValue,
    changedBy,
  ])
}

/** The role each account had at asOf, for accounts whose role changed after it (the "from" of the first such change) */
export async function rolesAt(asOf, client = pool) {
  const rows = await query(
    'select distinct on (user_id) user_id, from_role from account_role_changes where changed_at > $1 order by user_id, changed_at, id',
    [asOf],
    client,
  )
  return new Map(rows.map((row) => [row.user_id, row.from_role]))
}

/** Role changes made between from and to (inclusive), oldest first, grouped by user id */
export async function roleChangesBetweenByUser(from, to, client = pool) {
  const rows = await query(
    'select user_id, from_role, to_role, changed_at from account_role_changes where changed_at between $1 and $2 order by changed_at, id',
    [from, to],
    client,
  )
  const byUser = new Map()
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, [])
    byUser.get(row.user_id).push(row)
  }
  return byUser
}

/**
 * The value each account had at asOf, for accounts whose `field` changed after it: the "from" of their first change
 * after asOf (may be null, so callers check has(), not the value)
 */
export async function valuesAt(field, asOf, client = pool) {
  const rows = await query(
    'select distinct on (user_id) user_id, from_value from account_changes where field = $1 and changed_at > $2 order by user_id, changed_at, id',
    [field, asOf],
    client,
  )
  return new Map(rows.map((row) => [row.user_id, row.from_value]))
}

/** Each user's last sign-in on or before asOf: user id → Date */
export async function lastSignInsAtOrBefore(asOf, client = pool) {
  const rows = await query('select user_id, max(signed_in_at) as last_signed_in_at from account_sign_ins where signed_in_at <= $1 group by user_id', [asOf], client)
  return new Map(rows.map((row) => [row.user_id, row.last_signed_in_at]))
}

/** When sign-ins started being recorded (a Date), or null; before it, only each account's latest sign-in was known */
export async function signInHistoryStart(client = pool) {
  return (await one('select min(recorded_at) as first from account_sign_ins', [], client))?.first ?? null
}
