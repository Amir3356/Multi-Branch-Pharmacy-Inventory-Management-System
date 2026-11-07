import { Building2 } from 'lucide-react'

// Branch name pill used in tables; pass branch={null} with allBranches for the Owner's "All Branches"
export default function BranchTag({ branch, allBranches = false }) {
  const name = allBranches ? 'All Branches' : branch?.name || 'Unknown Branch'
  return (
    <span className="branch-tag" title={name}>
      <Building2 size={12} /> {name}
    </span>
  )
}
