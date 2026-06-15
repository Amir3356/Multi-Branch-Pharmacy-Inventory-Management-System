// An audit log entry, as the API sends it (server: reporting-service models/auditLog.model.js)

/**
 * @typedef {'create' | 'update' | 'delete' | 'approve' | 'reject' | 'view' | 'login' | 'logout' | 'other'} ActionType
 *
 * @typedef {object} AuditLog
 * @property {number} id
 * @property {string} occurredAt       ISO timestamp
 * @property {string | null} userName  who did it (or the email typed in, for a failed sign-in)
 * @property {string | null} userRole  e.g. "Cashier"
 * @property {string | null} branchId  the branch the action concerns
 * @property {string | null} branchName
 * @property {string} module           e.g. "Sales"
 * @property {string} action           e.g. "Sale recorded"
 * @property {ActionType} actionType
 * @property {string | null} recordId  e.g. "SL-00012"
 * @property {string} description
 * @property {object | null} before    the record as it was (updates, deletes)
 * @property {object | null} after     the record as it is now (creates, updates)
 * @property {string | null} ipAddress
 * @property {string | null} device    e.g. "Chrome on Windows"
 *
 * @typedef {{ data: AuditLog[], meta: { current_page: number, last_page: number, total: number, from: number | null, to: number | null }, modules: string[], actionTypes: ActionType[] }} AuditLogPage
 */

/** "Oct 11, 2026" and "2:32:05 PM" in this computer's time */
export const auditDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export const auditTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })

// The Action column's badge: a word and a colour per type
export const ACTION_TYPE_LABELS = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  approve: 'Approve',
  reject: 'Reject',
  view: 'View',
  login: 'Sign in',
  logout: 'Sign out',
  other: 'Other'
}

// All system modules recorded in the audit trail, in display order
export const AUDIT_MODULES = [
  'Sign-in',
  'Dashboard',
  'Accounts',
  'Branches',
  'Sessions',
  'User Report',
  'Products',
  'Policy',
  'Procurement',
  'Stock Transfers',
  'Sales',
  'Expenses',
  'Damaged Items',
  'Inventory',
  'Reports',
  'Audit Logs',
  'Notifications',
  'AI Assistance'
]

// All action types available for filtering
export const AUDIT_ACTION_TYPES = [
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'view',
  'login',
  'logout',
  'other'
]

const TONES = { create: 'created', approve: 'created', update: 'edited', delete: 'deleted', reject: 'deleted', view: 'viewed' }
export const actionTone = (type) => TONES[type] || 'other'

// Field names as people read them: "branch_id" → "Branch id", "expiryWarningDays" → "Expiry warning days"
export const fieldLabel = (key) => {
  const words = String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A snapshot value as text: objects and lists as compact JSON, empty as an em dash */
export const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * The rows of a before / after comparison: one per field in either snapshot, changed fields first. A create has only
 * `after`, a delete only `before`.
 */
export function snapshotRows(before, after) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
  const rows = keys.map((key) => {
    const was = before ? formatValue(before[key]) : null
    const now = after ? formatValue(after[key]) : null
    return { key, label: fieldLabel(key), was, now, changed: Boolean(before && after && was !== now) }
  })
  return rows.sort((a, b) => Number(b.changed) - Number(a.changed))
}

export const hasSnapshot = (log) => Boolean(log.before || log.after)
