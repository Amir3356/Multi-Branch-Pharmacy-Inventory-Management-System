import { Info } from 'lucide-react'

// Summary card: title, icon, big value, and a small chip underneath; `hint` adds an ⓘ next to the title explaining the figure
export default function StatCard({ title, icon: Icon, tone = 'cyan', value, valueStyle, chip, chipTone = 'neutral', chipTitle, hint, className = '' }) {
  return (
    <div className={`stat-card ${className}`.trim()}>
      <div className="stat-header">
        <span className="stat-title">
          {title}
          {hint && (
            <span className="stat-hint" title={hint} aria-label={hint} role="img" tabIndex={0}>
              <Info size={13} />
            </span>
          )}
        </span>
        <div className={`stat-icon-wrapper ${tone}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="stat-value" style={valueStyle}>{value}</div>
      {chip != null && (
        <div className={`stat-chip ${chipTone}`} title={chipTitle}>
          {chip}
        </div>
      )}
    </div>
  )
}
