import { iso8601 } from '../utils/index.js'
import { normalizeIp } from '../utils/clientIp.js'

/** An entry of the audit log (audit_logs, written only by this service, never changed or deleted) */
export const TABLE = 'audit_logs'

// The areas of the system an action can belong to, in the order the Owner's filter lists them
export const MODULES = Object.freeze([
  'Sign-in', 'Dashboard', 'Accounts', 'Branches', 'Sessions', 'User Report', 'Products', 'Policy', 'Procurement',
  'Stock Transfers', 'Sales', 'Expenses', 'Damaged Items', 'Inventory', 'Reports', 'Audit Logs', 'Notifications', 'AI Assistance',
])

// What kind of action an entry is, in the order the Owner's filter lists them
export const ACTION_TYPES = Object.freeze(['create', 'update', 'delete', 'approve', 'reject', 'view', 'login', 'logout', 'other'])

/**
 * The type of an action a service didn't label itself, from its wording ("Branch added" → create). The same rules
 * filled in the entries recorded before types existed (migrations/003_audit_trail.sql).
 */
export function inferActionType(action) {
  const a = String(action ?? '').toLowerCase()
  if (/failed sign-in|blocked sign-in/.test(a)) return 'reject'
  if (/^signed in/.test(a)) return 'login'
  if (/^signed out/.test(a)) return 'logout'
  if (/requested/.test(a)) return 'other'
  if (/deleted|removed/.test(a)) return 'delete'
  if (/confirmed|received|accepted|^stock added/.test(a)) return 'approve'
  if (/^viewed/.test(a)) return 'view'
  if (/updated|changed|renamed|corrected|regenerated|activated|ended|^password reset$/.test(a)) return 'update'
  if (/added|invited|recorded|created|generated|sent/.test(a)) return 'create'
  return 'other'
}

// Never stored in a snapshot, wherever they appear
const SECRET_KEY = /password|token|secret|remember|hash|idempotency/i
// A snapshot bigger than this is cut down to its top-level scalar fields
const MAX_SNAPSHOT_CHARS = 20000

/** A snapshot as stored: secrets dropped (at any depth), size capped; null stays null */
export function sanitizeSnapshot(value) {
  if (value === null || value === undefined) return null
  const clean = (v) => {
    if (Array.isArray(v)) return v.map(clean)
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).filter(([key]) => !SECRET_KEY.test(key)).map(([key, inner]) => [key, clean(inner)]))
    }
    return v
  }
  const cleaned = clean(value)
  if (JSON.stringify(cleaned).length <= MAX_SNAPSHOT_CHARS) return cleaned
  if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)) {
    const scalars = Object.fromEntries(Object.entries(cleaned).filter(([, v]) => v === null || typeof v !== 'object'))
    return { ...scalars, _note: 'Large nested fields left out of this snapshot' }
  }
  return { _note: 'Snapshot too large to store' }
}

/**
 * The pages a signed-in user can be recorded opening (POST /audit-logs/views), by the client's section key: the module
 * the view belongs to and the page's name.
 */
export const VIEWABLE_SECTIONS = Object.freeze({
  dashboard: { module: 'Dashboard', page: 'Dashboard' },
  accounts: { module: 'Accounts', page: 'Account Provision' },
  inventory: { module: 'Inventory', page: 'Inventory' },
  sales: { module: 'Sales', page: 'Sales History' },
  purchases: { module: 'Procurement', page: 'Procurement' },
  catalog: { module: 'Products', page: 'Category & Product' },
  transfers: { module: 'Stock Transfers', page: 'Stock Transfers' },
  damaged: { module: 'Damaged Items', page: 'Damaged Items' },
  expenses: { module: 'Expenses', page: 'Expenses' },
  reports: { module: 'Reports', page: 'Reports' },
  salesReport: { module: 'Reports', page: 'Sales Report' },
  inventoryReport: { module: 'Reports', page: 'Inventory Report' },
  financialReport: { module: 'Reports', page: 'Financial Report' },
  procurementReport: { module: 'Reports', page: 'Procurement Report' },
  userReports: { module: 'User Report', page: 'User Reports' },
  auditLogs: { module: 'Audit Logs', page: 'Audit Logs' },
  branches: { module: 'Branches', page: 'Branches' },
  policy: { module: 'Policy', page: 'Settings' },
  notifications: { module: 'Notifications', page: 'Notifications' },
  aiAssistance: { module: 'AI Assistance', page: 'AI Assistance' },
})

/** Entries per page on the Owner's Audit Logs page */
export const PER_PAGE = 25

/** AuditLogResource */
export const toResource = (log) => ({
  id: log.id,
  occurredAt: iso8601(log.occurred_at),
  userName: log.user_name,
  userRole: log.user_role,
  branchId: log.branch_id,
  branchName: log.branch_name,
  module: log.module,
  action: log.action,
  actionType: log.action_type,
  recordId: log.record_id,
  description: log.description,
  before: log.before_data ?? null,
  after: log.after_data ?? null,
  ipAddress: normalizeIp(log.ip_address),
  device: log.device,
})

/** The counts block: `since` as toIso8601String() of the oldest entry */
export const toCountsResource = (counts) => ({ total: counts.total, since: counts.since ? iso8601(counts.since) : null, today: counts.today, todayUsers: counts.todayUsers })
