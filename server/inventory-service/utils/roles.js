/**
 * Staff roles and what each one may open (RBAC). Section keys match the React app's PATHS keys, so the sidebar and
 * route guards on the client are driven by the same list the API enforces.
 */
export const ROLES = Object.freeze({
  OWNER: 'owner',
  INVENTORY_OFFICER: 'inventory_officer',
  CASHIER: 'cashier',
  PURCHASE_OFFICER: 'purchase_officer',
})

export const ROLE_LABELS = Object.freeze({
  owner: 'Owner',
  inventory_officer: 'Inventory Officer',
  cashier: 'Cashier',
  purchase_officer: 'Purchase Officer',
})

const SECTIONS = Object.freeze({
  owner: ['dashboard', 'accounts', 'branches', 'auditLogs', 'reports', 'salesReport', 'inventoryReport', 'financialReport', 'procurementReport', 'userReports', 'aiAssistance'],
  inventory_officer: ['dashboard', 'inventory', 'transfers', 'damaged', 'expenses', 'policy', 'reports', 'notifications', 'aiAssistance'],
  cashier: ['dashboard', 'sales', 'reports', 'aiAssistance'],
  purchase_officer: ['dashboard', 'purchases', 'catalog', 'reports', 'aiAssistance'],
})

/** Roles the Owner can invite. The Owner account itself is created from the command line or the seeder. */
export const STAFF_ROLES = Object.freeze([ROLES.INVENTORY_OFFICER, ROLES.CASHIER, ROLES.PURCHASE_OFFICER])

export const roleLabel = (role) => ROLE_LABELS[role] ?? role

/** Works across every branch, so no branch is assigned: the Owner, and the Purchase Officer who buys for all of them */
export const coversAllBranches = (role) => role === ROLES.OWNER || role === ROLES.PURCHASE_OFFICER

export const sectionsFor = (role) => SECTIONS[role] ?? []

export const homeSectionFor = (role) => sectionsFor(role)[0] ?? 'dashboard'

export const ACCOUNT_STATUSES = Object.freeze({ INVITED: 'invited', ACTIVE: 'active', INACTIVE: 'inactive' })

export const STATUS_LABELS = Object.freeze({ invited: 'Pending', active: 'Active', inactive: 'Inactive' })

export const statusLabel = (status) => STATUS_LABELS[status] ?? status
