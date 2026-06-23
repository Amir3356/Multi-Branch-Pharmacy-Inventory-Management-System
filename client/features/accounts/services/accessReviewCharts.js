// What an access review's charts show, worked out from its rows. Colours are fixed per entity, never by rank:
// a role keeps its colour in every chart, and a report missing a role doesn't repaint the others.

// Roles in a fixed order with their categorical colours (validated: neighbouring slices and bars stay distinct)
export const ROLE_SERIES = [
  { label: 'Owner', tone: 'role-1' },
  { label: 'Inventory Officer (Pharmacist)', tone: 'role-2' },
  { label: 'Cashier', tone: 'role-3' },
  { label: 'Purchase Officer', tone: 'role-4' }
]

// Account status: status colours, always shown with their label
const STATUS_TONES = { Active: 'status-good', Pending: 'status-warning', Inactive: 'status-neutral' }

const countBy = (rows, key) => rows.reduce((counts, r) => ({ ...counts, [key(r)]: (counts[key(r)] || 0) + 1 }), {})

/** Users per role, for the pie */
export const usersByRole = (rows) => {
  const counts = countBy(rows, (r) => r.roleLabel)
  return ROLE_SERIES.map((s) => ({ label: s.label, value: counts[s.label] || 0, tone: s.tone }))
}

/** Users per account status, for the donut */
export const usersByStatus = (rows) => {
  const counts = countBy(rows, (r) => r.status)
  return Object.keys(STATUS_TONES).map((status) => ({ label: status, value: counts[status] || 0, tone: STATUS_TONES[status] }))
}

/**
 * Accounts nobody is using: Active accounts with no sign-in for the dormant limit (or ever), plus invited people who
 * never joined. Each with the date they last signed in, if any.
 */
export const unusedAccounts = (rows, dormantDays) => ({
  notUsed: rows
    .filter((r) => r.status === 'Active' && (r.daysSinceLogin === null || r.daysSinceLogin >= dormantDays))
    .sort((a, b) => (b.daysSinceLogin ?? Infinity) - (a.daysSinceLogin ?? Infinity)),
  neverJoined: rows.filter((r) => r.status === 'Pending')
})
