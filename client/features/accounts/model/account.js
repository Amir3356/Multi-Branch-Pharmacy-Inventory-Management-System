// A staff account, as the API sends it (server: Accounts/Resources/AccountResource.php)

/**
 * @typedef {'owner' | 'inventory_officer' | 'cashier' | 'purchase_officer'} Role
 * @typedef {'Pending' | 'Active' | 'Inactive'} AccountStatus
 *
 * @typedef {object} Account
 * @property {number} id
 * @property {string} fullName
 * @property {string} email
 * @property {Role} role
 * @property {string} roleLabel           e.g. "Purchase Officer"
 * @property {string} branchId            'all' for the Owner
 * @property {string} branchName          'All Branches' for the Owner
 * @property {AccountStatus} status       Pending until the invitation is accepted
 * @property {boolean} [invitationExpired] only for Pending accounts
 * @property {string | null} lastLoginAt  ISO timestamp
 * @property {string | null} createdAt    ISO timestamp
 *
 * Sent to POST /accounts (new account: always invited) and PATCH /accounts/{id} (any subset)
 * @typedef {object} AccountPayload
 * @property {string} [fullName]
 * @property {string} [email]
 * @property {Role} [role]
 * @property {string} [branchId]
 * @property {'Active' | 'Inactive'} [status] only for accounts that accepted their invitation
 */

// Roles the Owner can give to staff accounts, with what each may open; each works at one branch.
// The Owner account itself is not created here: it covers all branches and manages these accounts.
export const ACCOUNT_ROLES = {
  // At a pharmacy branch the pharmacist does the Inventory Officer's job
  inventory_officer: { label: 'Inventory Officer (Pharmacist)', hint: 'Inventory, stock transfers, damaged items, settings and reports' },
  cashier: { label: 'Cashier', hint: 'Sales and reports' },
  purchase_officer: { label: 'Purchase Officer', hint: 'Purchase orders for every branch, and reports', allBranches: true }
}

export const EMPTY_ACCOUNT_FORM = { fullName: '', email: '', role: '', branchId: '', status: 'Active' }

/** The form filled in from an existing account */
/** Works across every branch, so no branch is assigned (the Purchase Officer; the server agrees) */
export const coversAllBranches = (role) => Boolean(ACCOUNT_ROLES[role]?.allBranches)

export const accountToForm = (account) => ({ fullName: account.fullName, email: account.email, role: account.role, branchId: account.branchId === 'all' ? '' : account.branchId, status: account.status })

/** @returns {AccountPayload} the form's values, cleaned up; `email` is already trimmed and lower-cased */
export const toAccountPayload = (form, email) => ({ fullName: form.fullName.trim(), email, role: form.role, branchId: coversAllBranches(form.role) ? null : form.branchId, status: form.status })

/** @returns {AccountPayload} what an edit sends: status only once the invitation was accepted */
export const toAccountChanges = (existing, data) => {
  const changes = { fullName: data.fullName, email: data.email, role: data.role, branchId: data.branchId }
  if (existing.status !== 'Pending') changes.status = data.status
  return changes
}
