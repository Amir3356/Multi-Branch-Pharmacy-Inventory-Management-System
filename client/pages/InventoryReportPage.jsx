import ReportPage from '../features/reports/components/ReportPage'
import { inventorySpec } from '../features/reports/services/specs/inventory'

// Reports → Inventory Report (Owner); the Inventory Officer sees their branch's under Reports
export default function InventoryReportPage() {
  return <ReportPage kind="inventory" title="Inventory Report" description="Stock on hand and its value, items that are low, out of stock or expiring, and how stock moved in the period." buildSpec={inventorySpec} />
}
