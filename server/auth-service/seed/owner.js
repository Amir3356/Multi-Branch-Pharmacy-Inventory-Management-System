// The Owner account: covers every branch and manages staff (Account Provision). Run through seed/index.js.
// Safe to run again: an existing Owner is never overwritten (their password may have changed since).
import { hashPassword, pool } from '../utils/index.js'

const OWNER = { fullName: 'Amir Siraj', email: 'amirsiraj1995@gmail.com', password: 'AEHJSS36' }

export async function seedOwner() {
  const { rowCount } = await pool.query("select 1 from users where role = 'owner'")
  if (rowCount) return console.log('An Owner account already exists; leaving it unchanged.')
  await pool.query(
    `insert into users (full_name, email, password, role, branch_id, status, email_verified_at, created_at, updated_at)
     values ($1, $2, $3, 'owner', null, 'active', now(), now(), now())`,
    [OWNER.fullName, OWNER.email, await hashPassword(OWNER.password)],
  )
  console.log(`Owner account created for ${OWNER.email}.`)
}
