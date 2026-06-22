import { useSelector } from 'react-redux'
import { PageHeader } from '../components'
import { useBranchScope } from '../hooks'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import InventoryOfficerDashboard from '../features/dashboard/components/InventoryOfficerDashboard'
import OwnerDashboard from '../features/dashboard/components/OwnerDashboard'
import CashierDashboard from '../features/dashboard/components/CashierDashboard'
import ProcurementOfficerDashboard from '../features/dashboard/components/ProcurementOfficerDashboard'

const ROLE_INTRO = {
  owner: 'Sales, purchases, expenses and profit across every branch.',
  inventory_officer: 'Your branch’s stock at a glance.',
  cashier: 'Your branch’s sales.',
  purchase_officer: 'Purchases for every branch.'
}

// Each role's home page
export default function DashboardPage() {
  const user = useSelector(selectCurrentUser)
  const { scopeLabel, branchById } = useBranchScope()
  const role = user?.role
  const staffBranchId = user?.branchId && user.branchId !== 'all' ? user.branchId : null

  return (
    <div className="content-section-card">
      <PageHeader centered title={`Dashboard · ${staffBranchId ? branchById(staffBranchId)?.name || '' : scopeLabel}`} description={ROLE_INTRO[role]} />
      {role === 'inventory_officer' && <InventoryOfficerDashboard branchId={staffBranchId} />}
      {role === 'owner' && <OwnerDashboard />}
      {role === 'cashier' && <CashierDashboard branchId={staffBranchId} />}
      {role === 'purchase_officer' && <ProcurementOfficerDashboard />}
    </div>
  )
}
