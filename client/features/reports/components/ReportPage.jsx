import { useState } from 'react'
import { AlertTriangle, ArrowDownUp, Banknote, Boxes, CalendarClock, CheckCircle2, CircleDollarSign, Clock, FileText, Radio, Hourglass, MailWarning, Package, PackageCheck, ShoppingCart, TrendingUp, Truck, UserCog, Users, UserX, Wallet } from 'lucide-react'
import { PageHeader, StatCard } from '../../../components'
import { useBranchScope, useFormatMoney } from '../../../hooks'
import { BarChart, ChartCard, DonutChart, HorizontalBarChart, PieChart } from '../../dashboard/components/Charts'
import { PeriodError, PeriodPicker } from '../../dashboard/components/DashboardParts'
import { useReport } from '../hooks/useReport'
import { exportReportPdf } from '../services/reportPdf'
import './ReportPage.css'

const CARD_ICONS = { revenue: CircleDollarSign, units: Boxes, cost: Wallet, profit: TrendingUp, net: Banknote, value: Package, low: AlertTriangle, expiry: CalendarClock, orders: ShoppingCart, pending: Hourglass, delivery: Truck, received: PackageCheck, movement: ArrowDownUp, time: Clock, users: Users, dormant: UserX, roles: UserCog, invites: MailWarning }

// A single headline figure instead of a chart: a big count (green tick when none), then who it is about
function Headline({ chart }) {
  const warn = chart.count > 0
  return (
    <>
      <div className={`dormant-hero ${warn ? 'warn' : 'ok'}`} role="status">
        <span className="dormant-hero-icon">{warn ? <UserX size={34} /> : <CheckCircle2 size={34} />}</span>
        <span className="dormant-hero-number">{chart.count}</span>
        <span className="dormant-hero-label">{chart.label}</span>
      </div>
      {warn && (
        <>
          <p className="unused-advice">{chart.advice}</p>
          <ul className="unused-list">
            {chart.list.map((item) => (
              <li key={item.name}>
                <UserX size={16} />
                <span className="fw-600">{item.name}</span>
                <span className="unused-why">{item.why}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

// One chart from a spec, drawn with the dashboard's charts
function SpecChart({ chart, money }) {
  if (chart.kind === 'headline') return <Headline chart={chart} />
  const format = chart.money ? money : (v) => Number(v).toLocaleString('en-US')
  if (chart.kind === 'pie') return <PieChart items={chart.items} format={format} emptyText={chart.empty} />
  if (chart.kind === 'donut') return <DonutChart items={chart.items} unit={chart.unit} emptyText={chart.empty} />
  if (chart.kind === 'hbar') return <HorizontalBarChart items={chart.items} format={format} emptyText={chart.empty} />
  return <BarChart columns={chart.columns} series={chart.series} format={format} wholeNumbers={chart.wholeNumbers} wrapLabels={chart.columns.length < 8} emptyText={chart.empty} />
}

function SpecTable({ table, centered }) {
  const isCentered = centered || table.title === 'Top products'
  return (
    <section className="report-table-section">
      <div className="report-table-heading" style={isCentered ? { justifyContent: 'center', textAlign: 'center' } : undefined}>
        <div style={isCentered ? { textAlign: 'center', width: '100%' } : undefined}>
          <h3 style={isCentered ? { textAlign: 'center' } : undefined}>{table.title}</h3>
          {table.note && (
            <span className="page-desc" style={isCentered ? { textAlign: 'center', display: 'block', marginTop: '0.25rem' } : undefined}>
              {table.note}
            </span>
          )}
        </div>
      </div>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>{table.columns.map((c) => <th key={c.label} className={c.align === 'right' ? 'num' : undefined}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className={table.strongRows?.includes(i) ? 'report-strong-row' : undefined}>
                {row.map((cell, j) => <td key={j} className={table.columns[j].align === 'right' ? 'num nowrap' : undefined}>{cell}</td>)}
              </tr>
            ))}
            {table.rows.length === 0 && (
              <tr><td colSpan={table.columns.length} className="report-empty">{table.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {table.footnote && (
        <p className="page-desc report-footnote" style={centered ? { textAlign: 'center' } : undefined}>
          {table.footnote}
        </p>
      )}
    </section>
  )
}

/**
 * A report page: period and branch filters, then the report's cards, charts and tables, with Export PDF. `kind` picks
 * the server report; `buildSpec(data, money)` turns its figures into what's shown (the PDF draws the same spec).
 */
export default function ReportPage({ kind, title, description, buildSpec, centered = true }) {
  const { period, branchId, setBranchId, canPickBranch, data, error, loading, isLive, updatedAt } = useReport(kind)
  const { branches, branchById } = useBranchScope()
  const money = useFormatMoney()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const spec = data ? buildSpec(data, money) : null
  const scope = branchId === 'all' ? 'All Branches' : branchById(branchId)?.name || branchId

  const exportPdf = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await exportReportPdf({ title, description, spec, periodText: period.text, scope, kind, from: data.from, to: data.to })
    } catch (e) {
      setExportError(`The PDF couldn't be created: ${e.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={`content-section-card report-page ${centered ? 'centered' : ''}`}>
      <PageHeader centered={centered} title={title} description={description}>
        <div className="report-header-actions">
          <span className={`stat-chip ${isLive ? 'positive' : 'neutral'}`} title={isLive ? 'The figures update the moment anything is recorded' : 'Live connection unavailable; the figures update every minute'}>
            <Radio size={13} /> {isLive ? 'Live' : 'Updates every minute'}
          </span>
          <button type="button" className="secondary-action-btn" onClick={exportPdf} disabled={!spec || exporting || loading}>
            <FileText size={16} /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </button>
        </div>
      </PageHeader>

      <div className="report-filters">
        <PeriodPicker state={period} errorId={`${kind}-range-error`} />
        {/* Styled like the period picker beside it; staff who work at one branch only see theirs, so there's nothing to pick */}
        {canPickBranch && (
          <div className="dashboard-period">
            <div className="form-group">
              <label htmlFor={`${kind}-branch`}>Branch</label>
              <select id={`${kind}-branch`} className="input-field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="all">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
      {!period.invalid && <p className="page-desc report-scope">{period.text} · {scope}{spec?.note ? ` · ${spec.note}` : ''}{updatedAt ? ` · Updated ${updatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : ''}</p>}

      {period.invalid && <PeriodError id={`${kind}-range-error`} />}
      {exportError && <p className="error-msg">{exportError}</p>}
      {error && <p className="error-msg">{error}</p>}
      {loading && !spec && <p className="page-desc report-loading">Loading the report…</p>}

      {spec && !period.invalid && (
        <div className={loading ? 'report-body is-loading' : 'report-body'} aria-busy={loading}>
          <div className="stats-grid report-cards">
            {spec.cards.map((c) => (
              <StatCard key={c.title} title={c.title} icon={CARD_ICONS[c.icon] || Package} tone={c.tone} value={c.value} chip={c.chip} chipTone={c.chipTone} hint={c.hint} />
            ))}
          </div>

          <div className="charts-grid">
            {spec.charts.map((chart) => (
              <ChartCard key={chart.title} title={chart.title} subtitle={chart.subtitle} centered={centered}>
                <SpecChart chart={chart} money={money} />
              </ChartCard>
            ))}
          </div>

          {spec.tables.map((table) => <SpecTable key={table.title} table={table} centered={centered} />)}
        </div>
      )}
    </div>
  )
}
