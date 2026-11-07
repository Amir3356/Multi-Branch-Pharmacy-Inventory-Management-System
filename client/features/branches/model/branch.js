// A branch, as the API sends it (server: Branches/Resources/BranchResource.php)

/**
 * @typedef {object} Branch
 * @property {string} id                 e.g. "BR-01"
 * @property {string} name
 * @property {string} location
 * @property {'Active' | 'Inactive'} status
 * @property {number} [staffCount]       staff accounts assigned to it
 *
 * Sent to POST /branches and PATCH /branches/{id} (any subset on edit)
 * @typedef {{ name?: string, location?: string, status?: 'Active' | 'Inactive' }} BranchPayload
 */

export const EMPTY_BRANCH_FORM = { name: '', location: '', status: 'Active' }

/** The form filled in from an existing branch */
export const branchToForm = (branch) => ({ name: branch.name, location: branch.location, status: branch.status })

/** @returns {BranchPayload} */
export const toBranchPayload = (form) => ({ name: form.name.trim(), location: form.location.trim(), status: form.status })
