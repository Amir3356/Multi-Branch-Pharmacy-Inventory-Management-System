import { one, query } from '../utils/index.js'
import { TOKENABLE_TYPE } from '../models/session.model.js'
import { nowSeconds } from '../utils/timestamps.js'
import { sha256 } from '../utils/tokens.js'

// Every database read and write for sessions (Sanctum's personal_access_tokens table)

/** The user columns a session needs (SessionResource, the identity context) */
const USER_COLUMNS = 'u.full_name, u.email, u.role, u.branch_id'

/** A new session (Sanctum token) named after the browser it was issued to; returns the row */
export async function createFor(userId, device, secret) {
  const now = nowSeconds()
  return one(
    `insert into personal_access_tokens (tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
     values ($1, $2, $3, $4, '["*"]', null, $5, $5) returning *`,
    [TOKENABLE_TYPE, userId, device, sha256(secret), now],
  )
}

export async function find(id) {
  return one('select * from personal_access_tokens where id = $1', [id])
}

/** One session with its user (tokenable; the user columns are null if it no longer exists), or null */
export async function withUser(id) {
  return one(
    `select t.*, u.id as user_id, ${USER_COLUMNS}
     from personal_access_tokens t
     left join users u on u.id = t.tokenable_id and t.tokenable_type = $2
     where t.id = $1`,
    [id, TOKENABLE_TYPE],
  )
}

/** Sign-ins from the last $days days whose user still exists: open sessions first, then by latest activity */
export async function recent(days) {
  return query(
    `select t.*, u.id as user_id, ${USER_COLUMNS}
     from personal_access_tokens t
     join users u on u.id = t.tokenable_id and t.tokenable_type = $2
     where t.created_at >= $1
     order by t.ended_at is not null, coalesce(t.last_used_at, t.created_at) desc`,
    [new Date(Date.now() - days * 86_400_000), TOKENABLE_TYPE],
  )
}

/** Deletes rows created more than $days days ago; returns how many */
export async function pruneOlderThan(days) {
  const rows = await query('delete from personal_access_tokens where created_at < $1 returning id', [new Date(Date.now() - days * 86_400_000)])
  return rows.length
}

/** Open sessions not used for the last $minutes minutes */
export async function openInactiveFor(minutes) {
  return query('select * from personal_access_tokens where ended_at is null and coalesce(last_used_at, created_at) < $1', [new Date(Date.now() - minutes * 60_000)])
}

/** Ids of the user's open sessions */
export async function openIdsFor(userId) {
  const rows = await query('select id from personal_access_tokens where tokenable_type = $1 and tokenable_id = $2 and ended_at is null', [TOKENABLE_TYPE, userId])
  return rows.map((row) => row.id)
}

/** Stamps the session ended; false when it had already ended (e.g. by a request at the same moment) */
export async function markEnded(id, reason) {
  const now = nowSeconds()
  const row = await one(
    'update personal_access_tokens set ended_at = $2, ended_reason = $3, updated_at = $2 where id = $1 and ended_at is null returning id',
    [id, now, reason],
  )
  return row !== null
}

export async function markManyEnded(userId, ids, reason) {
  const now = nowSeconds()
  await query(
    'update personal_access_tokens set ended_at = $4, ended_reason = $3, updated_at = $4 where tokenable_type = $1 and tokenable_id = $2 and id = any($5::bigint[])',
    [TOKENABLE_TYPE, userId, reason, now, ids],
  )
}

/** Sanctum stamps every authenticated request */
export async function touch(id) {
  const now = nowSeconds()
  await query('update personal_access_tokens set last_used_at = $2, updated_at = $2 where id = $1', [id, now])
}

export async function setAddress(id, ip) {
  await query('update personal_access_tokens set ip_address = $2, updated_at = $3 where id = $1', [id, ip, nowSeconds()])
}

/** source: 'ip' (looked up from the address) or 'device' (reported by the browser) */
export async function setLocation(id, location, source) {
  // The column holds 120 characters; a longer place name is cut rather than failing the request
  await query('update personal_access_tokens set location = $2, location_source = $3, updated_at = $4 where id = $1', [
    id,
    String(location).slice(0, 120),
    source,
    nowSeconds(),
  ])
}

export async function locationSource(id) {
  const row = await one('select location_source from personal_access_tokens where id = $1', [id])
  return row?.location_source ?? null
}

export async function remove(id) {
  await query('delete from personal_access_tokens where id = $1', [id])
}

/** Signs the user out everywhere by removing every session row (used when the account is deleted); returns how many */
export async function deleteAllFor(userId) {
  const rows = await query('delete from personal_access_tokens where tokenable_type = $1 and tokenable_id = $2 returning id', [TOKENABLE_TYPE, userId])
  return rows.length
}
