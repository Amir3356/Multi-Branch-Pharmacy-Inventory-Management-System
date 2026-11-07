import { DateTime, config, coversAllBranches, iso8601, roleLabel, statusLabel } from '../utils/index.js'
import { dbTime, isoInZone, truthy } from '../utils/php.js'
import * as userReportRepository from '../repositories/userReport.repository.js'

/**
 * User Report: every account as it stood at the end of the period (role, branch, status, last sign-in), with dormant
 * accounts, role changes and expired invitation links flagged. Worked out like a saved access review (user-service's
 * AccessReviewGenerator::compute, ported here read-only), but live: nothing is stored. With a branch chosen, only that
 * branch's staff (those covering every branch are left out).
 */
export async function buildUserReport(p) {
  const report = await computeAccessReview(
    DateTime.fromISO(p.from, { zone: p.zone }).startOf('day'),
    DateTime.fromISO(p.to, { zone: p.zone }).endOf('day'),
  )
  const branchName = truthy(p.branchId) ? await userReportRepository.branchName(p.branchId) : null
  const rows = truthy(branchName) ? report.rows.filter((r) => r.branchName === branchName) : report.rows
  const flagged = (flag) => rows.filter((r) => r.flags.includes(flag)).length

  return {
    asOf: report.summary.asOf,
    dormantDays: report.summary.dormantDays,
    totals: {
      users: rows.length,
      active: rows.filter((r) => r.status === 'Active').length,
      pending: rows.filter((r) => r.status === 'Pending').length,
      inactive: rows.filter((r) => r.status === 'Inactive').length,
      dormant: flagged('dormant'),
      roleChanged: flagged('role_changed'),
      invitationExpired: flagged('stale_invitation'),
    },
    rows,
  }
}

const DAY_MS = 86_400_000
const millis = (value) => (value instanceof Date ? value.getTime() : DateTime.isDateTime(value) ? value.toMillis() : value === null ? Date.now() : Date.parse(value))

/**
 * Each account as it stood at the end of the period (or now, for the current period): its last sign-in on or before
 * then, and its role, status and branch then, from the sign-in and change logs. `start`/`end` are in the store's zone.
 * Returns { summary: { dormantDays, asOf }, rows } (only the summary fields the User Report uses).
 */
async function computeAccessReview(start, end) {
  const now = DateTime.now().setZone(config.timezone)
  const asOf = end < now ? end : now
  const asOfMs = asOf.toMillis()
  const [fromDb, asOfDb] = [dbTime(start), dbTime(asOf)]
  const dormantDays = config.accessReviewDormantDays

  const [invitationRows, changeRows, signInRows, history, laterRoles, laterStatuses, laterBranches, branchRows, users] = await Promise.all([
    userReportRepository.invitations(),
    userReportRepository.roleChangesBetween(fromDb, asOfDb),
    userReportRepository.lastSignIns(asOfDb),
    userReportRepository.signInHistoryStart(),
    userReportRepository.roleChangesAfter(asOfDb),
    userReportRepository.fieldChangesAfter('status', asOfDb),
    userReportRepository.fieldChangesAfter('branch', asOfDb),
    userReportRepository.branches(),
    userReportRepository.usersCreatedBy(asOfDb),
  ])

  // Each pending account's latest invitation link (keyBy: the last row of a user wins)
  const invitations = new Map(invitationRows.map((i) => [i.user_id, i]))
  const changes = new Map()
  for (const change of changeRows) {
    if (!changes.has(change.user_id)) changes.set(change.user_id, [])
    changes.get(change.user_id).push(change)
  }
  const lastSignIns = new Map(signInRows.map((r) => [r.user_id, r.last_signed_in_at]))
  const historyStart = history?.first ?? null
  // How each account stood at asOf: the "from" of its first change after it (unique: the first row of a user wins)
  const firstPerUser = (rows, column) => {
    const values = new Map()
    for (const row of rows) if (!values.has(row.user_id)) values.set(row.user_id, row[column])
    return values
  }
  const rolesThen = firstPerUser(laterRoles, 'from_role')
  const statusesThen = firstPerUser(laterStatuses, 'from_value')
  const branchesThen = firstPerUser(laterBranches, 'from_value')
  const branchNames = new Map(branchRows.map((b) => [b.id, b.name]))

  const rows = users.map((user) => {
    const role = rolesThen.get(user.id) ?? user.role
    const status = statusesThen.has(user.id) ? statusesThen.get(user.id) : user.status
    const branchId = branchesThen.has(user.id) ? branchesThen.get(user.id) : user.branch_id

    // The log's last sign-in by then; the account's own latest sign-in is just as exact when it falls by then
    // (it covers accounts whose sign-ins weren't logged, e.g. seeded ones)
    const latest = user.last_login_at ?? null
    const lastLogin = lastSignIns.get(user.id) ?? (latest && millis(latest) <= asOfMs ? latest : null)
    // No sign-in on record by then, though the account has signed in since: before the sign-in history began only
    // each account's latest sign-in is known, so whether it signed in by then can't be told
    const lastLoginKnown = lastLogin !== null || !user.last_login_at || Boolean(historyStart && millis(historyStart) <= asOfMs)
    // Carbon's (int) diffInDays: whole days, truncated toward zero (UTC has no daylight saving)
    const daysSinceLogin = lastLogin ? Math.trunc((asOfMs - millis(lastLogin)) / DAY_MS) : null
    const roleChanges = (changes.get(user.id) ?? []).map((c) => ({ from: roleLabel(c.from_role), to: roleLabel(c.to_role), at: iso8601(c.changed_at) }))

    const flags = []
    if (status === 'active' && lastLoginKnown && (daysSinceLogin === null || daysSinceLogin >= dormantDays)) flags.push('dormant')
    if (roleChanges.length) flags.push('role_changed')
    const invitation = invitations.get(user.id)
    const linkWorks = Boolean(invitation) && millis(invitation.created_at) <= asOfMs && millis(invitation.expires_at) > asOfMs
    if (status === 'invited' && !linkWorks) flags.push('stale_invitation')
    if (status === 'inactive') flags.push('deactivated')

    return {
      userId: user.id,
      fullName: user.full_name,
      email: user.email,
      role,
      roleLabel: roleLabel(role),
      branchName: coversAllBranches(role) ? 'All Branches' : (branchNames.get(branchId) ?? null),
      status: statusLabel(status),
      createdAt: user.created_at ? DateTime.fromJSDate(user.created_at).setZone(config.timezone).toISODate() : null,
      lastLoginAt: iso8601(lastLogin),
      daysSinceLogin,
      // false: signed in at some point, but no record of whether it was by the end of the period
      lastLoginKnown,
      roleChanges,
      flags,
    }
  })

  return { summary: { dormantDays, asOf: isoInZone(asOf) }, rows }
}
