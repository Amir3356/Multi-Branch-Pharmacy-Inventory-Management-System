import { DateTime, config, one, query } from '../utils/index.js'
import { Params } from '../utils/params.js'
import { dbTime } from '../utils/time.js'
import { truthy } from '../utils/helpers.js'

/** Writes one entry (reporting-service is the only writer of audit_logs); returns its id */
export async function createAuditLog(entry) {
  const row = await one(
    `insert into audit_logs (occurred_at, user_id, user_name, user_role, branch_id, branch_name, module, action, record_id, description, ip_address, device, action_type, before_data, after_data)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb) returning id`,
    [
      entry.occurred_at, entry.user_id, entry.user_name, entry.user_role, entry.branch_id, entry.branch_name,
      entry.module, entry.action, entry.record_id, entry.description, entry.ip_address, entry.device,
      entry.action_type, entry.before_data === null ? null : JSON.stringify(entry.before_data), entry.after_data === null ? null : JSON.stringify(entry.after_data),
    ],
  )
  return row.id
}

/** Whether this user already has the same view recorded within the last `minutes` (repeat visits aren't re-logged) */
export async function recentView(userId, module, action, seconds) {
  const row = await one(
    `select 1 from audit_logs
     where user_id = $1 and action_type = 'view' and module = $2 and action = $3 and occurred_at >= $4
     limit 1`,
    // Written the same way as occurred_at, so the comparison is in the same time base
    [userId, module, action, new Date(Date.now() - seconds * 1000)],
  )
  return Boolean(row)
}

/** A branch's name for the log (its id if it no longer exists) */
export async function branchName(branchId) {
  if (!truthy(branchId)) return null
  return (await one('select name from branches where id = $1', [branchId]))?.name ?? branchId
}

/** The Audit Logs cards, across every branch and module: all actions ever recorded, and today's (store's local day) */
export async function counts() {
  const todayStart = dbTime(DateTime.now().setZone(config.timezone).startOf('day').toUTC())
  const row = await one(
    `select count(*) as total, min(occurred_at) as since,
      count(*) filter (where occurred_at >= $1) as today,
      count(distinct user_id) filter (where occurred_at >= $1 and user_id is not null) as today_users
     from audit_logs`,
    [todayStart],
  )
  return { total: Number(row.total), since: row.since, today: Number(row.today), todayUsers: Number(row.today_users) }
}

/**
 * Newest first, filtered: `from`/`to` are calendar days in the store's time zone, `search` matches the user,
 * action, record or details. Returns { total, rows } for the page.
 */
export async function search(filters, page, perPage) {
  const zone = config.timezone
  const p = new Params()
  const conditions = []
  if (truthy(filters.from)) conditions.push(`occurred_at >= ${p.add(dbTime(DateTime.fromISO(filters.from, { zone }).startOf('day').toUTC()))}`)
  if (truthy(filters.to)) conditions.push(`occurred_at <= ${p.add(dbTime(DateTime.fromISO(filters.to, { zone }).endOf('day').toUTC()))}`)
  if (truthy(filters.module)) conditions.push(`module = ${p.add(filters.module)}`)
  if (truthy(filters.type)) conditions.push(`action_type = ${p.add(filters.type)}`)
  if (truthy(filters.branchId)) conditions.push(`branch_id = ${p.add(filters.branchId)}`)
  if (truthy(filters.search)) {
    // LIKE wildcards typed by the user are matched literally
    const like = `%${filters.search.toLowerCase().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
    const term = p.add(like)
    conditions.push(`(lower(user_name) like ${term} or lower(action) like ${term} or lower(record_id) like ${term} or lower(description) like ${term})`)
  }
  const where = conditions.length ? `where ${conditions.join(' and ')}` : ''

  const total = Number((await one(`select count(*) as aggregate from audit_logs ${where}`, p.values)).aggregate)
  const rows = total
    ? await query(`select * from audit_logs ${where} order by occurred_at desc, id desc limit ${perPage} offset ${(page - 1) * perPage}`, p.values)
    : []
  return { total, rows }
}
