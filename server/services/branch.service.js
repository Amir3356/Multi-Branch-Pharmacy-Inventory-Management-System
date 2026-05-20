import { HttpError, audit, broadcast, isUniqueViolation, validationError } from '../utils/index.js'
import { str } from '../utils/rules.js'
import * as branches from '../repositories/branch.repository.js'
import { NAME_TAKEN } from '../models/branch.model.js'

/**
 * Branches (Laravel's BranchController logic and BranchBroadcaster). The live payload is what the old event sent: its
 * public properties (BranchesChanged: reason).
 */

/** Every open screen reloads its branch list, so an inactive branch stops being offered at once */
export const branchesChanged = (reason) => broadcast('branches', 'branches.changed', { reason })

/** Route-model binding: the branch in the URL, or Laravel's 404 */
export async function findOrFail(id) {
  const branch = await branches.find(id)
  if (!branch) throw new HttpError(404, `No query results for model [App\\Features\\Branches\\Models\\Branch] ${id}`)
  return branch
}

/** The unique-name check of BranchRequest (case-insensitive) */
export const nameTaken = (name, ignoreId = null) => branches.nameTaken(name, ignoreId)

export const list = () => branches.allWithStaffCount()

export const findWithStaffCount = (id) => branches.findWithStaffCount(id)

/** A save that lost the race for a name gets the validator's message */
async function guardNameRace(fn) {
  try {
    return await fn()
  } catch (error) {
    if (isUniqueViolation(error, 'branches_name_unique')) throw validationError({ name: NAME_TAKEN })
    throw error
  }
}

/** Adds a branch from validated data; returns the new branches row */
export async function create(req, data) {
  const branch = await guardNameRace(() => branches.create(data))
  audit(req, {
    module: 'Branches',
    action: 'Branch added',
    recordId: branch.id,
    description: `${branch.name} added at ${branch.location} (${branch.status}).`,
    branchId: branch.id,
    after: branch,
  })
  branchesChanged('added')
  return branch
}

/** Saves the validated changes; returns the branch as it is now */
export async function update(req, branch, data) {
  await guardNameRace(() => branches.update(branch, data))

  const after = { ...branch, ...data }
  const changes = ['name', 'location', 'status']
    .filter((field) => str(branch[field]) !== str(after[field]))
    .map((field) => `${field} “${str(branch[field])}” → “${str(after[field])}”`)
    .join(', ')
  audit(req, {
    module: 'Branches',
    action: 'Branch updated',
    recordId: branch.id,
    description: `${after.name}: ${changes || 'no changes'}.`,
    branchId: branch.id,
    before: branch,
    after,
  })
  branchesChanged('updated')
  return after
}

// A branch with staff can't be deleted (their accounts would lose their branch); deactivate it instead
export async function remove(req, branch) {
  if (await branches.hasStaff(branch.id)) {
    throw new HttpError(422, `${branch.name} can't be deleted because staff accounts are assigned to it. Deactivate it instead.`)
  }
  // Procurements, transfers and sales keep pointing at their branch, so its history must stay
  if (await branches.hasHistory(branch.id)) {
    throw new HttpError(422, `${branch.name} can't be deleted because it has procurement, transfer or sales records. Deactivate it instead.`)
  }

  await branches.remove(branch.id)
  // The branch is gone, so its name is passed rather than looked up
  audit(req, {
    module: 'Branches',
    action: 'Branch deleted',
    recordId: branch.id,
    description: `${branch.name} (${str(branch.location)}) was deleted.`,
    branchId: branch.id,
    branchName: branch.name,
    before: branch,
  })
  branchesChanged('deleted')
}
