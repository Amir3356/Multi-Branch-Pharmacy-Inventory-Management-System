import { query } from '../utils/index.js'
import { nowSeconds } from '../utils/timestamps.js'

// The sign-in history (account_sign_ins), kept for access reviews of past periods
export async function record(userId) {
  const now = nowSeconds()
  await query('insert into account_sign_ins (user_id, signed_in_at, recorded_at) values ($1, $2, $2)', [userId, now])
}

/** Removes a deleted account's sign-in history (the database cascaded this when users and sign-ins had a foreign key) */
export async function deleteAllFor(userId) {
  await query('delete from account_sign_ins where user_id = $1', [userId])
}
