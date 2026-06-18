import ReportPage from '../features/reports/components/ReportPage'
import { salesSpec } from '../features/reports/services/specs/sales'

// Reports → Sales Report (Owner); the Cashier sees their branch's under Reports
export default function SalesReportPage() {
  return <ReportPage kind="sales" title="Sales Report" description="Revenue, units and profit for the period, by branch, category, product and cashier." buildSpec={salesSpec} />
}
