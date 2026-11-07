import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { selectBranches } from '../features/branches/store/branchesSlice'
import { selectBranchInView } from '../features/auth/store/authSlice'

// Which branch the list pages show ("all" or one branch), with helpers for filtering and labels. Staff tied to a
// branch only see their own; the Owner and the Purchase Officer see every branch.
export function useBranchScope() {
  const branches = useSelector(selectBranches)
  const selectedBranch = useSelector(selectBranchInView)
  const branchById = useCallback((id) => branches.find((b) => b.id === id), [branches])
  const isAllBranches = selectedBranch === 'all'
  const currentBranch = branchById(selectedBranch)
  return {
    branches,
    branchById,
    selectedBranch,
    isAllBranches,
    currentBranch,
    scopeLabel: isAllBranches ? 'All Branches' : currentBranch?.name,
    inScope: (branchId) => isAllBranches || branchId === selectedBranch
  }
}
