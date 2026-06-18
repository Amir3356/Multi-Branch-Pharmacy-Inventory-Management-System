import ReportPage from '../features/reports/components/ReportPage'
import { usersSpec } from '../features/reports/services/specs/users'

// Reports → User Report (Owner)
export default function UserReportPage() {
  return (
    <ReportPage
      kind="users"
      title="User Report"
      description="Every staff member's role, branch, account status and last sign-in for the period, with dormant accounts highlighted."
      buildSpec={usersSpec}
      centered
    />
  )
}
