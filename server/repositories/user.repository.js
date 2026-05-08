import { one, pool, query } from '../utils/index.js'
import { ACCOUNT_COLUMNS } from '../utils/accounts.js'
import { nowSeconds } from '../utils/time.js'

// Every database read and write for user accounts (Laravel's UserRepository)

// The latest invitation (latestOfMany: highest id) comes along, so presenters can tell whether its link has expired
const DETAILS = `select ${ACCOUNT_COLUMNS},
    (select i.expires_at from account_invitations i where i.user_id = u.id order by i.id desc limit 1) as invitation_expires_at
  from users u left join branches b on b.id = u.branch_id`

/** Every account with its branch and latest invitation, oldest first */
export const allWithDetails = () => query(`${DETAILS} order by u.id`)

export const findWithDetails = (id, client = pool) => one(`${DETAILS} where u.id = $1`, [id], client)

/** The plain users row (with password when reading directly for auth); `forUpdate` locks it inside a transaction */
export const find = (id, client = pool, { forUpdate = false } = {}) =>
  one(
    `select id, full_name, email, password, role, branch_id, status, last_login_at, created_at, updated_at from users where id = $1${forUpdate ? ' for update' : ''}`,
    [id],
    client,
  )

export async function findByEmail(email) {
  return one('select * from users where email = $1', [email])
}

/** The user with its branch name, for the account payloads (presentAccount / presentAuthUser) */
export async function withBranch(id) {
  return one(`select ${ACCOUNT_COLUMNS} from users u left join branches b on b.id = u.branch_id where u.id = $1`, [id])
}

export async function recordLogin(id) {
  const now = nowSeconds()
  await query('update users set last_login_at = $2, updated_at = $2 where id = $1', [id, now])
}

/** A new password (already hashed); a reset also counts as signing in */
export async function setPassword(id, hash) {
  const now = nowSeconds()
  await query('update users set password = $2, last_login_at = $3, updated_at = $3 where id = $1', [id, hash, now])
}

/** Accounts that existed at asOf (a Date), oldest first */
export const createdBy = (asOf, client = pool) =>
  query('select id, full_name, email, role, branch_id, status, last_login_at, created_at from users where created_at <= $1 order by id', [asOf], client)

export const emailTaken = async (email, ignoreId = null) =>
  Boolean(await one('select 1 from users where email = $1 and ($2::bigint is null or id <> $2) limit 1', [email, ignoreId]))

/** Inserts a user; `password` must already be hashed. Returns the users row. */
export async function create(client, { fullName, email, role, branchId = null, status, password = null, emailVerified = false }) {
  return one(
    `insert into users (full_name, email, password, role, branch_id, status, email_verified_at, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, case when $7::boolean then now() end, now(), now())
     returning id, full_name, email, role, branch_id, status, last_login_at, created_at, updated_at`,
    [fullName, email, password, role, branchId, status, emailVerified],
    client,
  )
}

const UPDATABLE = ['full_name', 'email', 'role', 'branch_id', 'status']

/** Saves the changed profile columns (Eloquent touched updated_at only when something changed) */
export async function update(client, id, changes) {
  const columns = Object.keys(changes).filter((column) => UPDATABLE.includes(column))
  if (!columns.length) return
  const sets = columns.map((column, index) => `${column} = $${index + 2}`)
  await client.query(`update users set ${sets.join(', ')}, updated_at = now() where id = $1`, [id, ...columns.map((column) => changes[column])])
}

/**
 * Accepting an invitation: sets the (hashed) password and activates the account. Opening the emailed link proves they
 * own the address, and this is their first sign-in (last_login_at), as Laravel's UserRepository::activate did.
 */
export async function activate(client, id, passwordHash) {
  await client.query(
    `update users set password = $2, status = 'active', email_verified_at = now(), last_login_at = now(), updated_at = now() where id = $1`,
    [id, passwordHash],
  )
}

export const remove = (client, id) => client.query('delete from users where id = $1', [id])

/**
 * A reset link sent to the old address must stop working. password_reset_tokens belongs to auth-service, but there is
 * no internal endpoint for this, and Laravel removed the row in the same transaction as the email change.
 */
export const forgetPasswordResets = (client, email) => client.query('delete from password_reset_tokens where email = $1', [email])

// Branch lookups (branch-service's table, read only)

export const branchExists = async (id) => Boolean(await one('select 1 from branches where id = $1', [id]))

export const branchName = async (id, client = pool) => (await one('select name from branches where id = $1', [id], client))?.name ?? null

export async function branchNamesById(client = pool) {
  const rows = await query('select id, name from branches', [], client)
  return new Map(rows.map((row) => [row.id, row.name]))
}
