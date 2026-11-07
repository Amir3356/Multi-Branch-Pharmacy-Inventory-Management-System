import { one, query } from '../utils/index.js'
import { nowSeconds } from '../utils/timestamps.js'

// Laravel's DatabaseTokenRepository table: one row per email, holding the bcrypt hash of the emailed token

export async function find(email) {
  return one('select email, token, created_at from password_reset_tokens where email = $1', [email])
}

/** Replaces any earlier token for the address (Laravel deletes existing ones, then inserts) */
export async function create(email, hashedToken) {
  await query('delete from password_reset_tokens where email = $1', [email])
  await query('insert into password_reset_tokens (email, token, created_at) values ($1, $2, $3)', [email, hashedToken, nowSeconds()])
}

export async function remove(email) {
  await query('delete from password_reset_tokens where email = $1', [email])
}
