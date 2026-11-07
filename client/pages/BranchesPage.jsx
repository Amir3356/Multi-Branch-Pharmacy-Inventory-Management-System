import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Plus } from 'lucide-react'
import { Notice, PageHeader } from '../components'
import { useBranchScope } from '../hooks'
import { addBranch, deleteBranch, toggleBranchStatus, updateBranch } from '../features/branches/store/branchesThunks'
import BranchesTable from '../features/branches/components/BranchesTable'
import BranchModal from '../features/branches/components/BranchModal'
import './BranchesPage.css'

export default function BranchesPage() {
  const dispatch = useDispatch()
  const { branches, selectedBranch } = useBranchScope()
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  const [notice, setNotice] = useState(null)

  const run = async (thunk) => {
    try {
      setNotice({ type: 'success', text: await dispatch(thunk) })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  // Errors are thrown back to the modal so it can show them under the fields
  const handleAdd = async (data) => {
    await dispatch(addBranch(data))
    setShowAddBranch(false)
  }

  const handleEdit = async (data) => {
    setNotice({ type: 'success', text: await dispatch(updateBranch(editingBranch, data)) })
    setEditingBranch(null)
  }

  // Deactivating closes the branch at once, so it asks first; activating again needs no warning
  const handleToggleStatus = (branch) => {
    const deactivating = branch.status === 'Active'
    if (deactivating && !window.confirm(`Deactivate ${branch.name}?\n\nIt will be closed: no new sales, transfers, purchase orders, expenses, damaged items or stock corrections can be recorded there until you activate it again. Its records are kept.`)) return
    run(toggleBranchStatus(branch))
  }

  const handleDelete = (branch) => {
    if (!window.confirm(`Delete ${branch.name}? This cannot be undone.`)) return
    run(deleteBranch(branch))
  }

  return (
    <div className="content-section-card">
      <PageHeader centered title="Branches" description="Manage supermarket branches across the network: edit details, activate or deactivate, and delete branches.">
        <button className="primary-action-btn" onClick={() => setShowAddBranch(true)}>
          <Plus size={16} /> Create Branch
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <BranchesTable data={branches} selectedBranch={selectedBranch} onEdit={setEditingBranch} onToggleStatus={handleToggleStatus} onDelete={handleDelete} />

      {editingBranch && <BranchModal branch={editingBranch} branches={branches} onClose={() => setEditingBranch(null)} onSave={handleEdit} />}
      {showAddBranch && <BranchModal branches={branches} onClose={() => setShowAddBranch(false)} onSave={handleAdd} />}
    </div>
  )
}
