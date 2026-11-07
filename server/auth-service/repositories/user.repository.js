import { ACCOUNT_COLUMNS, one, query } from '../utils/index.js'
import { nowSeconds } from '../utils/timestamps.js'

// The users reads auth needs, and the two columns it owns (password, last_login_at). user-service owns the rest.
// Eloquent's save() also stamped updated_at, so these writes do too.

export async function findByEmail(email) {
  return one('select * from users where email = $1', [email])
}

export async function find(id) {
  return one('select * from users where id = $1', [id])
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
