import { one, pool, query } from '../utils/index.js'

// Every database read and write for account invitations (Laravel's InvitationRepository)

/** Replaces any earlier invitation for the user with a new one that expires `minutes` from now */
export async function replaceFor(client, userId, invitedBy, tokenHash, minutes) {
  await deleteFor(client, userId)
  return one(
    `insert into account_invitations (user_id, invited_by, token_hash, expires_at, created_at, updated_at)
     values ($1, $2, $3, now() + make_interval(mins => $4), now(), now())
     returning id, user_id, expires_at`,
    [userId, invitedBy, tokenHash, minutes],
    client,
  )
}

/** The invitation for a token hash, with its user and the user's branch name */
export const findByTokenHash = (tokenHash) =>
  one(
    `select i.id, i.user_id, i.expires_at,
        u.full_name, u.email, u.role, u.branch_id, u.status, b.name as branch_name
     from account_invitations i
     join users u on u.id = i.user_id
     left join branches b on b.id = u.branch_id
     where i.token_hash = $1`,
    [tokenHash],
  )

export const deleteFor = (client, userId) => client.query('delete from account_invitations where user_id = $1', [userId])

/** Each user's latest invitation: user id → { createdAt, expiresAt } (access reviews) */
export async function latestByUser(client = pool) {
  const rows = await query('select distinct on (user_id) user_id, created_at, expires_at from account_invitations order by user_id, id desc', [], client)
  return new Map(rows.map((row) => [row.user_id, { createdAt: row.created_at, expiresAt: row.expires_at }]))
}
