/**
 * Branch: a row of the branches table (id BR-01, BR-02, …; status active | inactive), and its JSON shape
 * (Laravel's Branch model and BranchResource).
 */
export const STATUSES = Object.freeze(['active', 'inactive'])

export const NAME_TAKEN = 'A branch with this name already exists.'

/** BranchResource: status shown capitalised ("Active"); staffCount when it was counted */
export function presentBranch(branch) {
  const status = String(branch.status ?? '')
  return {
    id: branch.id,
    name: branch.name,
    location: branch.location,
    status: status.charAt(0).toUpperCase() + status.slice(1),
    ...(branch.staff_count !== undefined ? { staffCount: branch.staff_count } : {}),
  }
}
