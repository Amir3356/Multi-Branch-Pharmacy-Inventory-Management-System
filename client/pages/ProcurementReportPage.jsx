import ReportPage from '../features/reports/components/ReportPage'
import { procurementSpec } from '../features/reports/services/specs/procurement'

// Reports → Procurement Report (Owner); the Purchase Officer sees it under Reports
export default function ProcurementReportPage() {
  return <ReportPage kind="procurement" title="Procurement Report" description="Purchase orders placed in the period: spending by supplier and branch, and where each order stands." buildSpec={procurementSpec} />
}
