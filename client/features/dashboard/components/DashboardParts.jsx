import { Package } from 'lucide-react'
import { StatCard } from '../../../components'
import { PERIODS } from '../services/periods'

// Pieces every role's dashboard is built from: a titled section, the period picker, and a row of summary cards.

/** A dashboard section with its heading, a line under it, and optional controls on the right */
export function DashboardSection({ id, title, description, actions, centered, children }) {
  return (
    <section className="dashboard-section" aria-labelledby={id}>
      <div
        className="section-header dashboard-section-header"
        style={centered ? { justifyContent: 'center', textAlign: 'center' } : undefined}
      >
        <div style={centered ? { textAlign: 'center', width: '100%' } : undefined}>
          <h3 id={id} style={centered ? { textAlign: 'center' } : undefined}>{title}</h3>
          {description && <p className="page-desc" style={centered ? { textAlign: 'center' } : undefined}>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/** Period select, plus From/To for a custom range; `state` comes from usePeriod() */
export function PeriodPicker({ state, errorId }) {
  const { period, setPeriod, custom, setCustom, invalid } = state
  const dateProps = { 'aria-invalid': invalid, 'aria-describedby': invalid ? errorId : undefined, className: `input-field ${invalid ? 'error' : ''}` }
  return (
    <div className="dashboard-period">
      <div className="form-group">
        <label htmlFor="dashboard-period">Period</label>
        <select id="dashboard-period" className="input-field" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {Object.entries(PERIODS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      {period === 'custom' && (
        <>
          <div className="form-group">
            <label htmlFor="dashboard-from">From</label>
            <input id="dashboard-from" type="date" max={custom.to || undefined} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} {...dateProps} />
          </div>
          <div className="form-group">
            <label htmlFor="dashboard-to">To</label>
            <input id="dashboard-to" type="date" min={custom.from || undefined} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} {...dateProps} />
          </div>
        </>
      )}
    </div>
  )
}

export const PeriodError = ({ id }) => (
  <p id={id} className="error-msg dashboard-range-error" role="alert">Choose a start date on or before the end date.</p>
)

/** Summary cards from dashboardCards(); `icons` maps each card's icon key to an icon */
export function CardGrid({ cards, icons, className }) {
  return (
    <div className={className}>
      {cards.map((card) => (
        <StatCard key={card.title} className={card.wide ? 'wide' : ''} title={card.title} icon={icons[card.icon] || Package} tone={card.tone} hint={card.hint} value={card.value} chip={card.chip} chipTone={card.chipTone} />
      ))}
    </div>
  )
}
