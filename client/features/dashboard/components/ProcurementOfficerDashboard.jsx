import { useSelector } from 'react-redux'
import { DollarSign, Truck } from 'lucide-react'
import { useBranchScope, useFormatMoney } from '../../../hooks'
import { selectSettings } from '../../policy/store/settingsSlice'
import { selectPurchases } from '../../purchases/store/purchasesSlice'
import { dashboardCards } from '../services/dashboardCards'
import { purchasesOverTime } from '../services/dashboardCharts'
import { usePeriod } from '../hooks/usePeriod'
import { BarChart, ChartCard } from './Charts'
import { CardGrid, PeriodError, PeriodPicker } from './DashboardParts'

const ICONS = { money: DollarSign, truck: Truck }

// The Purchase Officer's dashboard, for every branch (or the one picked in the header): purchases for the chosen period
export default function ProcurementOfficerDashboard() {
  const formatMoney = useFormatMoney()
  const settings = useSelector(selectSettings)
  const { inScope } = useBranchScope()
  const period = usePeriod()

  const purchases = useSelector(selectPurchases).filter((p) => inScope(p.branchId))

  const cards = dashboardCards('purchase_officer', { purchases }, { money: formatMoney, settings, period })
  const shortMoney = (v) => formatMoney(v).replace(/\.00$/, '')

  return (
    <>
      {/* The period comes first: every card and chart below follows it */}
      <div className="dashboard-toolbar">
        <PeriodPicker state={period} errorId="dashboard-range-error" />
        {!period.invalid && <p className="page-desc">{period.text} · by order date</p>}
      </div>
      <div className="dashboard-section">
        {period.invalid ? <PeriodError id="dashboard-range-error" /> : (
          <>
            <CardGrid className="dashboard-period-grid" icons={ICONS} cards={cards} />
            <div className="charts-grid">
              <ChartCard title="Purchases over Time" subtitle={`Paid orders · ${period.name}`}>
                <BarChart
                  columns={purchasesOverTime(purchases, period.range)}
                  series={[{ label: 'Purchases', tone: 'cyan' }]}
                  format={shortMoney}
                  emptyText="No paid orders in this period."
                />
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </>
  )
}
