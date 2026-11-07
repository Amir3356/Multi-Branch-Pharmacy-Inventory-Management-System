import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AlertTriangle, Ban, Clock, DollarSign, Package, PackageCheck, PackageX, Wallet, XCircle } from 'lucide-react'
import { useFormatMoney } from '../../../hooks'
import { selectSettings } from '../../policy/store/settingsSlice'
import { selectInventory } from '../../inventory/store/selectors'
import { selectPurchases } from '../../purchases/store/purchasesSlice'
import { selectTransfers } from '../../transfers/store/transfersSlice'
import { selectDamaged } from '../../damaged/store/damagedSlice'
import { selectExpenses } from '../../expenses/store/expensesSlice'
import { loadExpenses } from '../../expenses/store/expensesThunks'
import { dashboardCards } from '../services/dashboardCards'
import { expensesByCategory, lowestStock, spendingOverTime, stockStatusBreakdown } from '../services/dashboardCharts'
import { usePeriod } from '../hooks/usePeriod'
import { BarChart, ChartCard, DonutChart, HorizontalBarChart } from './Charts'
import { CardGrid, DashboardSection, PeriodError, PeriodPicker } from './DashboardParts'

const ICONS = { procurement: PackageCheck, stock: Package, low: AlertTriangle, clock: Clock, expired: XCircle, empty: Ban, money: DollarSign, damaged: PackageX, wallet: Wallet }

// Chart colour for each stock status
// Stock states coloured by meaning, checked with the dataviz palette validator on the white card: green = fine,
// blue = running low (order more), amber = expiring soon, red = expired, grey = none left. Every pair of neighbouring
// slices is told apart with normal and colour-blind vision; the legend names each one.
const STATUS_TONE = { 'In Stock': 'status-good', 'Low Stock': 'role-1', 'Expiring Soon': 'role-4', Expired: 'status-critical', 'Out of Stock': 'slate' }

// The Inventory Officer's dashboard: their branch's stock right now, then spending for the chosen period
export default function InventoryOfficerDashboard({ branchId }) {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const settings = useSelector(selectSettings)
  const period = usePeriod()
  const atBranch = (id) => id === branchId

  const inventory = useSelector(selectInventory).filter((i) => atBranch(i.branchId))
  const purchases = useSelector(selectPurchases).filter((p) => atBranch(p.branchId))
  const incomingTransfers = useSelector(selectTransfers).filter((t) => atBranch(t.to))
  const damaged = useSelector(selectDamaged).filter((d) => atBranch(d.branchId))
  const expenses = useSelector(selectExpenses).filter((e) => atBranch(e.branchId))

  // Expenses are only loaded by their own page otherwise
  useEffect(() => {
    dispatch(loadExpenses()).catch(() => {})
  }, [dispatch])

  const cards = dashboardCards('inventory_officer', { inventory, purchases, incomingTransfers, damaged, expenses }, { money: formatMoney, settings, period })
  // Chart axes and bars drop the cents on whole amounts
  const shortMoney = (v) => formatMoney(v).replace(/\.00$/, '')

  return (
    <>
      {/* The period comes first, at the top like the other dashboards; it sets the Spending section below
          (Stock right now is always live) */}
      <div className="dashboard-toolbar">
        <PeriodPicker state={period} errorId="dashboard-range-error" />
        {!period.invalid && <p className="page-desc">{period.text} · sets the Spending section</p>}
      </div>

      <DashboardSection centered id="dashboard-stock-title" title="Stock right now" description="Live from Inventory. The period doesn’t change these.">
        <CardGrid className="dashboard-stock-grid" icons={ICONS} cards={cards.filter((c) => c.group === 'stock')} />
        <div className="charts-grid">
          <ChartCard title="Stock Status" subtitle="Batches by status">
            <DonutChart items={stockStatusBreakdown(inventory).map((s) => ({ ...s, tone: STATUS_TONE[s.label] }))} unit="batches" emptyText="No stock in this branch yet." />
          </ChartCard>
          <ChartCard title="Lowest Stock" subtitle={`Units on hand · low below ${settings.defaultMinStock}`}>
            <HorizontalBarChart
              items={lowestStock(inventory).map((p) => ({ ...p, tone: p.value <= 0 ? STATUS_TONE['Out of Stock'] : p.value < settings.defaultMinStock ? STATUS_TONE['Low Stock'] : STATUS_TONE['In Stock'] }))}
              format={(v) => `${v.toLocaleString()} units`}
              emptyText="No stock in this branch yet."
            />
          </ChartCard>
        </div>
      </DashboardSection>

      <DashboardSection
        id="dashboard-spending-title"
        title="Spending"
        description={period.invalid ? 'Choose a valid date range.' : period.text}
      >
        {period.invalid ? <PeriodError id="dashboard-range-error" /> : (
          <>
            <CardGrid className="dashboard-period-grid" icons={ICONS} cards={cards.filter((c) => c.group === 'period')} />
            <div className="charts-grid">
              <ChartCard title="Expenses and Damage Loss" subtitle={period.name}>
                <BarChart
                  columns={spendingOverTime({ expenses, damaged }, period.range)}
                  series={[{ label: 'Expenses', tone: 'role-1' }, { label: 'Damage Loss', tone: 'role-2' }]}
                  format={shortMoney}
                  emptyText="No expenses or damage in this period."
                />
              </ChartCard>
              <ChartCard title="Expenses by Category" subtitle={period.name}>
                <HorizontalBarChart items={expensesByCategory(expenses, period.range)} format={shortMoney} emptyText="No expenses in this period." />
              </ChartCard>
            </div>
          </>
        )}
      </DashboardSection>
    </>
  )
}
