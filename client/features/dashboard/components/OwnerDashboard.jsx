import { useEffect, useRef, useState } from 'react'
import { Building2, CreditCard, DollarSign, PackageCheck, PackageX, ShoppingCart, Users, Wallet } from 'lucide-react'
import { BranchTag, EmptyRow } from '../../../components'
import { useBranchScope, useFormatMoney, useMoneyColumns } from '../../../hooks'
import { realtime } from '../../../api/realtime'
import { fetchOwnerDashboard } from '../../../api/ownerDashboardApi'
import { dashboardCards } from '../services/dashboardCards'
import { moneyOverTime, sliceTone, topSlices } from '../services/dashboardCharts'
import { usePeriod } from '../hooks/usePeriod'
import { ChartCard, ComposedChart, PieChart, RevenueSplitChart } from './Charts'
import { CardGrid, DashboardSection, PeriodError, PeriodPicker } from './DashboardParts'

const ICONS = { sales: ShoppingCart, procurement: PackageCheck, wallet: Wallet, damaged: PackageX, money: DollarSign, branch: Building2, staff: Users, card: CreditCard }

// One colour per pie slice, the last (grey) for Other

// Without a live connection the figures refresh this often
const FALLBACK_REFRESH_MS = 60000

// The Owner's dashboard: the whole business (or one branch) for the chosen period, worked out by the server
export default function OwnerDashboard() {
  const formatMoney = useFormatMoney()
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const { branches, branchById } = useBranchScope()
  const period = usePeriod()
  const [branchId, setBranchId] = useState('all')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [from, to] = period.range

  const load = useRef(() => {})
  useEffect(() => {
    if (period.invalid) return
    let cancelled = false
    load.current = () =>
      fetchOwnerDashboard({ from, to, branchId })
        .then(({ data }) => {
          if (cancelled) return
          setSummary(data)
          setError(null)
        })
        .catch((e) => !cancelled && setError(e.message))
    load.current()
    return () => {
      cancelled = true
    }
  }, [from, to, branchId, period.invalid])

  // Every recorded action (a sale, a payment, an expense…) reaches the Owner's audit channel: refresh shortly after,
  // once for a burst of them. Without the live connection, every minute.
  useEffect(() => {
    let timer = null
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(() => load.current(), 1500)
    }
    const echo = realtime()
    echo?.private('audit-logs').listen('.audit-log.recorded', soon)
    const fallback = setInterval(() => load.current(), FALLBACK_REFRESH_MS)
    return () => {
      echo?.leave('audit-logs')
      clearTimeout(timer)
      clearInterval(fallback)
    }
  }, [])

  const shortMoney = (v) => formatMoney(v).replace(/\.00$/, '')
  const cards = summary ? dashboardCards('owner', summary, { money: formatMoney, period }) : []
  const scope = branchId === 'all' ? 'All branches' : branchById(branchId)?.name

  return (
    <>
      {/* The period and branch come first: everything below follows them */}
      <div className="dashboard-toolbar">
        <PeriodPicker state={period} errorId="owner-range-error" />
        <div className="form-group dashboard-branch-filter">
          <label htmlFor="owner-branch">Branch</label>
          <select id="owner-branch" className="input-field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {!period.invalid && <p className="page-desc">{period.text} · {scope}</p>}
      </div>

      {period.invalid ? <PeriodError id="owner-range-error" /> : (
        <>
          {error && <p className="error-msg" style={{ marginTop: '1rem' }}>{error}</p>}
          {!summary && !error && <p className="chart-empty">Loading the figures…</p>}
          {summary && (
            <>
              <DashboardSection centered id="owner-money-title" title="Money In & Out" description={`${period.name} · ${scope}`}>
                <CardGrid className="dashboard-money-grid" icons={ICONS} cards={cards.filter((c) => c.group === 'period')} />
                <div className="charts-grid">
                  <ChartCard title="Revenue, Purchases and Expenses" subtitle={period.name}>
                    {/* Composed: Revenue and Purchases as bars, Expenses as a line, all in ETB on one axis */}
                    <ComposedChart
                      columns={moneyOverTime(summary.daily, period.range)}
                      bars={[{ label: 'Revenue', tone: 'role-1' }, { label: 'Purchases', tone: 'role-2' }]}
                      lines={[{ label: 'Expenses', tone: 'role-3' }]}
                      format={shortMoney}
                      emptyText="No sales, purchases or expenses in this period."
                    />
                  </ChartCard>
                  <ChartCard title="Top Selling Products" subtitle={`Share of revenue · ${period.name}`}>
                    <PieChart
                      items={topSlices(summary.topProducts.map((p) => ({ label: p.product, value: p.total, qty: p.qty }))).map((p, index) => ({
                        ...p,
                        tone: sliceTone(p, index),
                        detail: `${p.qty.toLocaleString()} ${p.qty === 1 ? 'unit' : 'units'} sold`
                      }))}
                      format={shortMoney}
                      emptyText="No sales in this period."
                    />
                  </ChartCard>
                  {/* Where revenue goes: one bar split into what it paid for and the profit kept (the Net Profit card's figures) */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <ChartCard title={summary.totals.netProfit >= 0 ? 'Net Profit (est.)' : 'Net Loss (est.)'} subtitle={`Where your sales money goes · ${period.name}`}>
                      <RevenueSplitChart
                        revenue={summary.totals.sales}
                        costs={[
                          { label: 'Cost of items sold', value: summary.totals.costOfSales, tone: 'role-1' },
                          { label: 'Expenses', value: summary.totals.expenses, tone: 'role-4' },
                          { label: 'Damage loss', value: summary.totals.damageLoss, tone: 'role-5' }
                        ]}
                        profitTone="role-7"
                        lossTone="status-critical"
                        format={shortMoney}
                        emptyText="No sales, expenses or damage in this period."
                      />
                    </ChartCard>
                  </div>
                </div>
              </DashboardSection>

              <DashboardSection centered id="owner-branches-title" title="Branch Performance" description={`Every branch side by side · ${period.name}. Net profit (an estimate) is sales minus what the sold items cost to buy, the branch's expenses and its damage loss.`}>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Branch</th>
                        <th>{moneyHeader('Sales')}</th>
                        <th>{moneyHeader('Purchases')}</th>
                        <th>{moneyHeader('Expenses')}</th>
                        <th>{moneyHeader('Damage Loss')}</th>
                        <th>{moneyHeader('Net Profit')}</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...summary.branches].sort((a, b) => b.sales - a.sales).map((b) => (
                        <tr key={b.id}>
                          <td><BranchTag branch={branchById(b.id) || { id: b.id, name: b.name }} /></td>
                          <td className="fw-600">{formatAmount(b.sales)}</td>
                          <td>{formatAmount(b.purchases)}</td>
                          <td>{formatAmount(b.expenses)}</td>
                          <td className={b.damageLoss ? 'amount-negative' : undefined}>{formatAmount(b.damageLoss)}</td>
                          <td className={`fw-600 ${b.netProfit < 0 ? 'amount-negative' : 'amount-positive'}`}>{formatAmount(b.netProfit)}</td>
                          <td>{b.status}</td>
                        </tr>
                      ))}
                      {summary.branches.length === 0 && <EmptyRow colSpan={7}>No branches yet.</EmptyRow>}
                    </tbody>
                  </table>
                </div>
              </DashboardSection>

              <DashboardSection centered id="owner-now-title" title="Right Now" description="The current state; the period doesn’t change these.">
                <CardGrid className="dashboard-two-grid" icons={ICONS} cards={cards.filter((c) => c.group === 'now')} />
              </DashboardSection>
            </>
          )}
        </>
      )}
    </>
  )
}
