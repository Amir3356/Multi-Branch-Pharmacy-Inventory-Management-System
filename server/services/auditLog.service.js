import { HttpError, broadcast, describeDevice, limit, logger, roleLabel, sectionsFor } from '../utils/index.js'
import { branchName, counts, createAuditLog, recentView, search } from '../repositories/auditLog.repository.js'
import { VIEWABLE_SECTIONS, inferActionType, sanitizeSnapshot } from '../models/auditLog.model.js'

// Every time someone opens a page is a View. Only a repeat within this many seconds is skipped: that is the same
// opening reported twice (React rendering the page twice, a double click), not a new visit.
const VIEW_REPEAT_SECONDS = 3
// Views being recorded right now, so two requests arriving together (e.g. a double render) make one entry
const viewsInFlight = new Set()

const ANNOUNCE_AFTER_MS = 250
let announceTimer = null

/**
 * AuditLogger::record for the internal API: fills in what the caller doesn't send (role label, branch name, device,
 * the action's type), strips secrets from the before / after snapshots, writes the entry (permanently: the table
 * refuses updates and deletes) and tells the Owner's Audit Logs page. Returns the new id.
 */
export async function record({ module, action, recordId = null, description, branchId = null, branchName: givenBranchName = null, actor = null, actorName = null, ip = null, userAgent = null, type = null, before = null, after = null }) {
  const id = await createAuditLog({
    // timestamp(0) would round fractions of a second; Laravel's now() was written truncated
    occurred_at: new Date(Math.floor(Date.now() / 1000) * 1000),
    user_id: actor?.id ?? null,
    user_name: actor?.fullName ?? actorName ?? null,
    user_role: actor?.role ? roleLabel(actor.role) : null,
    branch_id: branchId,
    branch_name: givenBranchName ?? (await branchName(branchId)),
    module,
    action,
    record_id: recordId,
    description: limit(description, 2000),
    ip_address: ip,
    device: userAgent ? describeDevice(userAgent) : null,
    action_type: type ?? inferActionType(action),
    before_data: sanitizeSnapshot(before),
    after_data: sanitizeSnapshot(after),
  })
  announce()
  return id
}

/**
 * A signed-in user opened a page (the client reports it when the page mounts). Only pages their role can open are
 * recorded, each time they open it. Returns whether an entry was written.
 */
export async function recordPageView(req, section) {
  const user = req.user
  const allowed = sectionsFor(user.role).includes(section)
  if (!allowed) throw new HttpError(403, 'Your role does not have access to this section.')

  const { module, page } = VIEWABLE_SECTIONS[section]
  const action = `Viewed ${page}`
  const key = `${user.id}|${action}`
  if (viewsInFlight.has(key)) return false
  viewsInFlight.add(key)
  try {
    if (await recentView(user.id, module, action, VIEW_REPEAT_SECONDS)) return false
    await record({
      module,
      action,
      type: 'view',
      description: `${user.fullName} opened the ${page} sidebar${user.branchId && user.branchId !== 'all' ? '' : ' (all branches)'}.`,
      branchId: user.branchId && user.branchId !== 'all' ? user.branchId : null,
      actor: { id: user.id, fullName: user.fullName, role: user.role },
      ip: req.clientIp,
      userAgent: req.userAgent,
    })
    return true
  } finally {
    viewsInFlight.delete(key)
  }
}

/**
 * One live update for a burst of entries: the first entry starts a short timer and every entry recorded before it
 * fires shares the same push, so the page reloads at most once per 250 ms. Laravel sent one per request, after the
 * response; a broadcast problem never reaches the caller.
 */
function announce() {
  if (announceTimer) return
  announceTimer = setTimeout(() => {
    announceTimer = null
    try {
      broadcast('audit-logs', 'audit-log.recorded', {})
    } catch (error) {
      logger.warn('Live audit log update not sent', { error: error.message })
    }
  }, ANNOUNCE_AFTER_MS)
  announceTimer.unref?.()
}

/**
 * The Owner's Audit Logs page: read only, newest first, filtered and paged on the server.
 * Returns { rows, total, page, totals } for the controller to shape.
 */
export async function list(filters, perPage) {
  const page = filters.page !== undefined && filters.page !== null ? Number.parseInt(String(filters.page).trim(), 10) : 1
  const [{ total, rows }, totals] = await Promise.all([search(filters, page, perPage), counts()])
  return { rows, total, page, totals }
}
