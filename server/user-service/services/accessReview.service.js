import { ACCOUNT_STATUSES, DateTime, ROLE_LABELS, audit, config, coversAllBranches, iso8601, pool, roleLabel, statusLabel, transaction } from '../utils/index.js'
import { localNow, parseDate } from '../utils/dates.js'
import { MODELS, modelNotFound, numericId, ucfirst } from '../utils/http.js'
import * as reviews from '../repositories/accessReview.repository.js'
import * as users from '../repositories/user.repository.js'
import * as invitations from '../repositories/invitation.repository.js'
import * as history from '../repositories/accountHistory.repository.js'
import { UNIT } from '../models/accessReview.model.js'

/**
 * Access review (user report) for a period: a snapshot of every account with its role and last login, flagging what
 * management should look at (Laravel's AccessReviewGenerator and AccessReviewController logic):
 *  - dormant            active, but no sign-in for ACCESS_REVIEW_DORMANT_DAYS (default 90)
 *  - role_changed       role changed during the period (possible privilege creep)
 *  - stale_invitation   still invited, but its emailed link no longer works: resend or delete
 *  - deactivated        blocked but still on file
 *
 * Each account is shown as it was at the end of the period (or now, for the current period), from the sign-in and
 * change logs. Periods are in the store's local time (STORE_TIMEZONE); stored timestamps are UTC.
 */

/** Carbon's toIso8601String() in the value's own zone: '2026-11-05T13:15:00+03:00' */
const isoLocal = (dateTime) => dateTime.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ")

// Laravel sent query dates as 'Y-m-d H:i:s' (no fractions): compare against whole seconds the same way
const toDb = (dateTime) => dateTime.toUTC().startOf('second').toJSDate()

/** The current period up to now (Generate): today, this week (from Monday), this month, quarter or year */
export function currentPeriodToDate(type) {
  const now = localNow()
  return [now.startOf(UNIT[type]), now]
}

/** The last finished period, which gives a Complete report: yesterday, last week (Mon–Sun), last month, quarter or year */
export function previousPeriod(type) {
  const unit = UNIT[type]
  const start = localNow().startOf(unit).minus({ [`${unit}s`]: 1 })
  return [start, start.endOf(unit)]
}

/** Works out a report and saves it (the schedule's reports, and the API's generate); returns { id } */
export async function generate(client, start, end, type, { by = null, scheduled = false } = {}) {
  const { summary, rows } = await compute(start, end, client)
  return reviews.create(client, {
    periodStart: start.toISODate(),
    periodEnd: end.toISODate(),
    periodType: type,
    scheduled,
    generatedBy: by?.id ?? null,
    summary,
    rows,
  })
}

/** Works out a report without saving it: { summary, rows } */
export async function compute(start, end, client = pool) {
  const now = localNow()
  const asOf = end < now ? end : now
  const [fromDb, asOfDb] = [toDb(start), toDb(asOf)]
  const asOfMs = asOf.toMillis()
  const dormantDays = config.accessReviewDormantDays

  const [invitationsByUser, changes, lastSignIns, historyStart, rolesThen, statusesThen, branchesThen, branchNames, accounts] = await Promise.all([
    invitations.latestByUser(client),
    history.roleChangesBetweenByUser(fromDb, asOfDb, client),
    // How each account stood at asOf: changes made after it are undone
    history.lastSignInsAtOrBefore(asOfDb, client),
    history.signInHistoryStart(client),
    history.rolesAt(asOfDb, client),
    history.valuesAt('status', asOfDb, client),
    history.valuesAt('branch', asOfDb, client),
    users.branchNamesById(client),
    users.createdBy(asOfDb, client),
  ])

  const rows = accounts.map((user) => {
    const role = rolesThen.get(user.id) ?? user.role
    const status = statusesThen.has(user.id) ? statusesThen.get(user.id) : user.status
    const branchId = branchesThen.has(user.id) ? branchesThen.get(user.id) : user.branch_id

    // The log's last sign-in by then; the account's own latest sign-in is just as exact when it falls by then
    // (it covers accounts whose sign-ins weren't logged, e.g. seeded ones)
    const latest = user.last_login_at
    const lastLogin = lastSignIns.get(user.id) ?? (latest && latest.getTime() <= asOfMs ? latest : null)
    // No sign-in on record by then, though the account has signed in since: before the sign-in history began only
    // each account's latest sign-in is known, so whether it signed in by then can't be told
    const lastLoginKnown = lastLogin !== null || !latest || Boolean(historyStart && historyStart.getTime() <= asOfMs)
    const daysSinceLogin = lastLogin ? Math.trunc((asOfMs - lastLogin.getTime()) / 86_400_000) : null
    const roleChanges = (changes.get(user.id) ?? []).map((change) => ({
      from: roleLabel(change.from_role),
      to: roleLabel(change.to_role),
      at: iso8601(change.changed_at),
    }))

    const flags = []
    if (status === ACCOUNT_STATUSES.ACTIVE && lastLoginKnown && (daysSinceLogin === null || daysSinceLogin >= dormantDays)) flags.push('dormant')
    if (roleChanges.length) flags.push('role_changed')
    const invitation = invitationsByUser.get(user.id)
    const linkWorks = Boolean(
      invitation && (invitation.createdAt?.getTime() ?? Date.now()) <= asOfMs && invitation.expiresAt.getTime() > asOfMs,
    )
    if (status === ACCOUNT_STATUSES.INVITED && !linkWorks) flags.push('stale_invitation')
    if (status === ACCOUNT_STATUSES.INACTIVE) flags.push('deactivated')

    return {
      userId: user.id,
      fullName: user.full_name,
      email: user.email,
      role,
      roleLabel: roleLabel(role),
      branchName: coversAllBranches(role) ? 'All Branches' : (branchNames.get(branchId) ?? null),
      status: statusLabel(status),
      createdAt: DateTime.fromJSDate(user.created_at).setZone(config.timezone).toISODate(),
      lastLoginAt: iso8601(lastLogin),
      daysSinceLogin,
      // false: signed in at some point, but no record of whether it was by the end of the period
      lastLoginKnown,
      roleChanges,
      flags,
    }
  })

  const count = (flag) => rows.filter((row) => row.flags.includes(flag)).length
  const summary = {
    totalUsers: rows.length,
    byRole: Object.fromEntries(Object.entries(ROLE_LABELS).map(([role, label]) => [label, rows.filter((row) => row.role === role).length])),
    dormant: count('dormant'),
    roleChanged: count('role_changed'),
    staleInvitations: count('stale_invitation'),
    deactivated: count('deactivated'),
    needsAttention: rows.filter((row) => row.flags.length).length,
    dormantDays,
    asOf: isoLocal(asOf),
  }

  return { summary, rows }
}

/** Scheduled: a Complete report for the period that just ended, made at most once per period */
export async function generateScheduled(type) {
  const [start, end] = previousPeriod(type)
  if (await reviews.scheduledExists(type, start.toISODate(), end.toISODate())) return
  // No transaction, as the queued Laravel job had none: the pool runs each query
  await generate(pool, start, end, type, { scheduled: true })
}

/** Route-model binding: the report in the URL, or Laravel's 404 */
export async function findOrFail(id) {
  const reviewId = numericId(id)
  const review = reviewId === null ? null : await reviews.find(reviewId)
  if (!review) throw modelNotFound(MODELS.accessReview, id)
  return review
}

/** The newest 50 reports, without their row tables */
export const latest = () => reviews.latest()

/** One report with its full row table */
export const findWithPeople = (id) => reviews.findWithPeople(id)

/**
 * Generate a report from validated input: the current period so far (today, this week/month/quarter/year), the
 * previous finished one (scope=previous: yesterday, last week/month/quarter/year), or a custom date range (from/to,
 * inclusive, not in the future). Returns { review (with its rows and people), replaced (ids of the earlier reports for
 * the same period that it replaces) }.
 */
export async function generateManual(req, input) {
  const period = String(input.period)
  const [start, end] =
    period === 'custom'
      ? [parseDate(input.from, config.timezone).setZone(config.timezone).startOf('day'), parseDate(input.to, config.timezone).setZone(config.timezone).endOf('day')]
      : (input.scope ?? 'current') === 'previous'
        ? previousPeriod(period)
        : currentPeriodToDate(period)

  // Generating the same period again replaces its earlier report with fresh data, instead of piling up copies
  const { review, replaced } = await transaction(async (client) => {
    const replacedIds = await reviews.deleteManualFor(client, period, start.toISODate(), end.toISODate())
    return { review: await generate(client, start, end, period, { by: req.user }), replaced: replacedIds }
  })

  audit(req, {
    module: 'User Report',
    action: replaced.length ? 'User report regenerated' : 'User report generated',
    recordId: review.id,
    description: `${ucfirst(period)} report for ${start.toISODate()} – ${end.toISODate()}.`,
    type: 'create',
    before: replaced.length ? { replacedReports: replaced } : null,
    after: { id: review.id, period, from: start.toISODate(), to: end.toISODate() },
  })

  return { review: await reviews.findWithPeople(review.id), replaced }
}

export async function remove(req, review) {
  await reviews.remove(review.id)
  audit(req, {
    module: 'User Report',
    action: 'User report deleted',
    recordId: review.id,
    description: `${ucfirst(review.period_type)} report for ${review.period_start} – ${review.period_end} was deleted.`,
    before: { id: review.id, period: review.period_type, from: review.period_start, to: review.period_end },
  })
}
