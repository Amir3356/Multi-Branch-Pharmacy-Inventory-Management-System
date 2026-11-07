import { createBranch, destroyBranch, fetchBranches, patchBranch } from '../../../api/branchesApi'
import { branchRemoved, branchSaved, branchesLoaded } from './branchesSlice'

// Branch thunks call the API and return the confirmation message; failures throw ApiError

export const loadBranches = () => async (dispatch) => {
  const { data } = await fetchBranches()
  dispatch(branchesLoaded(data))
}

export const addBranch = (data) => async (dispatch) => {
  const { branch, message } = await createBranch(data)
  dispatch(branchSaved(branch))
  return message
}

export const updateBranch = (existing, data) => async (dispatch) => {
  const { branch, message } = await patchBranch(existing.id, data)
  dispatch(branchSaved(branch))
  return message
}

export const toggleBranchStatus = (existing) => async (dispatch) => {
  const status = existing.status === 'Active' ? 'Inactive' : 'Active'
  const { branch } = await patchBranch(existing.id, { status })
  dispatch(branchSaved(branch))
  return status === 'Active'
    ? `${branch.name} is now Active and can record sales again.`
    : `${branch.name} is now Inactive. It can't be chosen when recording new sales.`
}

// The API refuses to delete a branch that still has staff assigned
export const deleteBranch = (branch) => async (dispatch) => {
  const { message } = await destroyBranch(branch.id)
  dispatch(branchRemoved(branch.id))
  return message
}
