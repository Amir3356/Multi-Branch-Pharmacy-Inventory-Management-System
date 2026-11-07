import { useSelector } from 'react-redux'
import { Package, Receipt, ShoppingCart } from 'lucide-react'
import { useFormatMoney } from '../../../hooks'
import { selectSettings } from '../../policy/store/settingsSlice'
import { selectSales } from '../../sales/store/salesSlice'
import { dashboardCards } from '../services/dashboardCards'
import { salesOverTime, sliceTone, topSellingSlices } from '../services/dashboardCharts'
import { usePeriod } from '../hooks/usePeriod'
import { BarChart, ChartCard, PieChart } from './Charts'
import { CardGrid, PeriodError, PeriodPicker } from './DashboardParts'

const ICONS = { receipt: Receipt, sales: ShoppingCart, stock: Package }

// One colour per pie slice, the last (grey) for Other

// The Cashier's dashboard: their branch's sales for the chosen period (Today's Sales is always today)
export default function CashierDashboard({ branchId }) {
  const formatMoney = useFormatMoney()
  const settings = useSelector(selectSettings)
  const period = usePeriod()

  const sales = useSelector(selectSales).filter((s) => s.branchId === branchId)

  const cards = dashboardCards('cashier', { sales }, { money: formatMoney, settings, period })
  const shortMoney = (v) => formatMoney(v).replace(/\.00$/, '')

  return (
    <>
      {/* The period comes first: the cards and charts below follow it */}
      <div className="dashboard-toolbar">
        <PeriodPicker state={period} errorId="dashboard-range-error" />
        {!period.invalid && <p className="page-desc">{period.text}</p>}
      </div>
      <div className="dashboard-section">
        {period.invalid ? <PeriodError id="dashboard-range-error" /> : (
          <>
            <CardGrid className="dashboard-three-grid" icons={ICONS} cards={cards} />
            <div className="charts-grid">
              <ChartCard title="Sales over Time" subtitle={period.name}>
                <BarChart
                  columns={salesOverTime(sales, period.range)}
                  series={[{ label: 'Sales', tone: 'teal' }]}
                  format={shortMoney}
                  emptyText="No sales in this period."
                />
              </ChartCard>
              <ChartCard title="Top Selling Products" subtitle={`Share of sales · ${period.name}`}>
                <PieChart
                  items={topSellingSlices(sales, period.range).map((p, index) => ({
                    ...p,
                    tone: sliceTone(p, index),
                    detail: `${p.qty.toLocaleString()} ${p.qty === 1 ? 'unit' : 'units'} sold`
                  }))}
                  format={shortMoney}
                  emptyText="No sales in this period."
                />
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </>
  )
}
