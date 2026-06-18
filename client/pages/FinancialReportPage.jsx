import ReportPage from '../features/reports/components/ReportPage'
import { financialSpec } from '../features/reports/services/specs/financial'

// Reports → Financial Report (Owner)
export default function FinancialReportPage() {
  return <ReportPage kind="financial" title="Financial Report" description="Profit and loss for the period: revenue, cost of goods, expenses and damage losses, compared with the period before." buildSpec={financialSpec} />
}
