// Small dependency-free charts for the dashboard. Colours come from CSS classes so they follow the theme.

/** A titled card that holds one chart */
export function ChartCard({ title, subtitle, centered, children }) {
  const isCentered = centered || title === 'Top products'
  return (
    <div className="chart-card">
      <div
        className="chart-card-header"
        style={isCentered ? { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } : undefined}
      >
        <h4 style={isCentered ? { textAlign: 'center', width: '100%' } : undefined}>{title}</h4>
        {subtitle && (
          <span
            className="chart-subtitle"
            style={isCentered ? { textAlign: 'center', width: '100%', marginTop: '0.25rem' } : undefined}
          >
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

const ChartEmpty = ({ children }) => <p className="chart-empty">{children}</p>

/** Ring split into slices; `items` are { label, value, tone } */
export function DonutChart({ items, unit, emptyText }) {
  const total = items.reduce((t, i) => t + i.value, 0)
  if (!total) return <ChartEmpty>{emptyText}</ChartEmpty>
  const radius = 15.9155 // circumference 100, so dash lengths are percentages
  // Each slice starts where the previous one ended, from 12 o'clock
  const slices = items.filter((i) => i.value).reduce((list, i) => {
    const share = (i.value / total) * 100
    const prev = list[list.length - 1]
    return [...list, { ...i, share, offset: prev ? prev.offset - prev.share : 25 }]
  }, [])
  return (
    <div className="donut-chart">
      <svg viewBox="0 0 42 42" role="img" aria-label={items.map((i) => `${i.label}: ${i.value}`).join(', ')}>
        <circle cx="21" cy="21" r={radius} className="donut-track" />
        {slices.map((i) => (
          <circle key={i.label} cx="21" cy="21" r={radius} className={`donut-slice tone-${i.tone}`} strokeDasharray={`${i.share} ${100 - i.share}`} strokeDashoffset={i.offset}>
            <title>{`${i.label}: ${i.value} ${unit}`}</title>
          </circle>
        ))}
        <text x="21" y="21" className="donut-total">{total.toLocaleString()}</text>
        <text x="21" y="26.5" className="donut-unit">{unit}</text>
      </svg>
      <ul className="chart-legend">
        {items.map((i) => (
          <li key={i.label}>
            <span className={`legend-dot tone-${i.tone}`} />
            {i.label}
            <strong>{i.value.toLocaleString()}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One bar per row; `items` are { label, value, tone, detail? } (detail shows after the value) */
export function HorizontalBarChart({ items, format = (v) => v.toLocaleString(), emptyText }) {
  // Nothing to list: empty placeholder rows keep the chart's shape, with the empty text over them
  if (!items.length) {
    return (
      <div className="hbar-placeholder">
        <ul className="hbar-chart" aria-hidden="true">
          {[72, 56, 40, 28, 16].map((width) => (
            <li key={width}>
              <span className="hbar-label"><span className="placeholder-line" style={{ width: `${width + 20}%` }} /></span>
              <span className="hbar-track"><span className="hbar-fill tone-slate" style={{ width: `${width}%` }} /></span>
              <span className="hbar-value">—</span>
            </li>
          ))}
        </ul>
        <p className="hbar-placeholder-text"><span>{emptyText}</span></p>
      </div>
    )
  }
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="hbar-chart">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${format(i.value)}${i.detail ? ` · ${i.detail}` : ''}`}>
          <span className="hbar-label">{i.label}</span>
          <span className="hbar-track">
            <span className={`hbar-fill tone-${i.tone || 'cyan'}`} style={{ width: `${Math.max((i.value / max) * 100, i.value ? 2 : 0)}%` }} />
          </span>
          <span className="hbar-value">{format(i.value)}{i.detail && <small> · {i.detail}</small>}</span>
        </li>
      ))}
      {/* Rows that are all zero still show, with the empty text under them */}
      {items.every((i) => !i.value) && <li className="hbar-note">{emptyText}</li>}
    </ul>
  )
}

// A round step for the value axis (1, 2, 2.5 or 5 × a power of ten) so about four gridlines cover `max`;
// `minStep` keeps counts on whole numbers (no "1.5 people")
function niceTicks(max, minStep = 0) {
  const rough = Math.max(max / 4, minStep)
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((v) => v >= rough && (!minStep || Number.isInteger(v)))
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
}

/** Bar chart: one group of side-by-side bars per column; `series` are { label, tone }, each column is { label, title, values[] }.
 * `wrapLabels` gives long labels (product names) two lines instead of one; `wholeNumbers` keeps the axis on whole counts. */
export function BarChart({ columns, series, format = (v) => v.toLocaleString(), emptyText, wrapLabels = false, wholeNumbers = false }) {
  const max = Math.max(...columns.flatMap((c) => c.values), 0)
  // With nothing to show the axes and columns stay, with the empty text over them
  const ticks = max ? niceTicks(max, wholeNumbers ? 1 : 0) : [0, 0, 0, 0, 0]
  const top = ticks[ticks.length - 1] || 1
  // Keep the axis readable when there are many columns
  const labelEvery = Math.ceil(columns.length / 10)
  return (
    <div className={`bar-chart ${wrapLabels ? 'wrap-labels' : ''}`}>
      <div className="bar-chart-scale">
        {[...ticks].reverse().map((t, i) => <span key={i}>{max || i === ticks.length - 1 ? format(t) : ''}</span>)}
      </div>
      <div className="bar-chart-plot">
        <div className="bar-chart-grid">
          {ticks.map((t, i) => <span key={i} />)}
        </div>
        {!max && <p className="bar-chart-empty">{emptyText}</p>}
        {columns.map((c, index) => (
          <div key={c.title} className={`bar-group ${columns.length === 1 ? 'single' : ''}`} title={`${c.title}\n${series.map((s, k) => `${s.label}: ${format(c.values[k])}`).join('\n')}`}>
            <div className="bar-group-bars">
              {c.values.map((v, k) => (
                // A small amount still shows as a sliver rather than nothing
                <span key={series[k].label} className={`bar tone-${series[k].tone}`} style={{ height: v ? `max(3px, ${(v / top) * 100}%)` : 0 }} />
              ))}
            </div>
            <span className="bar-label">{index % labelEvery === 0 ? c.label : ''}</span>
          </div>
        ))}
      </div>
      <ul className="chart-legend inline">
        {series.map((s) => (
          <li key={s.label}><span className={`legend-dot tone-${s.tone}`} />{s.label}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Composed chart: side-by-side bars for `bars` series plus a line with dot markers for `lines` series, on one shared
 * value axis (never two scales). Each column is { label, title, values[] }: the bar values first, then the line values.
 * Columns are equal width with no gap between them, so a column's centre is exactly (i + 0.5) / n of the plot and the
 * line's points sit over the dots.
 */
export function ComposedChart({ columns, bars, lines, format = (v) => v.toLocaleString(), emptyText, wholeNumbers = false }) {
  const series = [...bars, ...lines]
  const max = Math.max(...columns.flatMap((c) => c.values), 0)
  const ticks = max ? niceTicks(max, wholeNumbers ? 1 : 0) : [0, 0, 0, 0, 0]
  const top = ticks[ticks.length - 1] || 1
  const labelEvery = Math.ceil(columns.length / 10)
  const n = columns.length
  const pct = (v) => (v / top) * 100
  return (
    <div className="bar-chart composed-chart">
      <div className="bar-chart-scale">
        {[...ticks].reverse().map((t, i) => <span key={i}>{max || i === ticks.length - 1 ? format(t) : ''}</span>)}
      </div>
      <div className="bar-chart-plot">
        <div className="bar-chart-grid">
          {ticks.map((t, i) => <span key={i} />)}
        </div>
        {!max && <p className="bar-chart-empty">{emptyText}</p>}
        {/* The line, drawn under the dots; a single column has no line, only its dot */}
        {max > 0 && n > 1 && lines.map((line, l) => (
          <svg key={line.label} className="composed-line" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" aria-hidden="true">
            <polyline
              className={`tone-${line.tone}`}
              points={columns.map((c, i) => `${i + 0.5},${100 - pct(c.values[bars.length + l])}`).join(' ')}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ))}
        {columns.map((c, index) => (
          <div key={c.title} className={`bar-group ${n === 1 ? 'single' : ''}`} title={`${c.title}\n${series.map((s, k) => `${s.label}: ${format(c.values[k])}`).join('\n')}`}>
            <div className="bar-group-bars">
              {bars.map((b, k) => {
                const v = c.values[k]
                return <span key={b.label} className={`bar tone-${b.tone}`} style={{ height: v ? `max(3px, ${pct(v)}%)` : 0 }} />
              })}
              {max > 0 && lines.map((line, l) => (
                <span key={line.label} className={`composed-dot tone-${line.tone}`} style={{ bottom: `${pct(c.values[bars.length + l])}%` }} />
              ))}
            </div>
            <span className="bar-label">{index % labelEvery === 0 ? c.label : ''}</span>
          </div>
        ))}
      </div>
      <ul className="chart-legend inline">
        {bars.map((s) => <li key={s.label}><span className={`legend-dot tone-${s.tone}`} />{s.label}</li>)}
        {lines.map((s) => <li key={s.label}><span className={`legend-line tone-${s.tone}`} />{s.label}</li>)}
      </ul>
    </div>
  )
}

/**
 * "Where revenue goes": one bar for the period's revenue, split into what it paid for (`costs`: [{ label, value, tone }])
 * and what was left as profit (`profitTone`). When costs are more than revenue the bar covers the costs instead, a
 * marker shows where revenue ran out, and a bracket under the bar marks the part past it as the loss. A table under
 * the bar lists every part with its amount and share of revenue, so nothing depends on colour alone.
 */
export function RevenueSplitChart({ revenue, costs, profitTone, lossTone, format = (v) => v.toLocaleString(), emptyText }) {
  const spent = costs.reduce((total, c) => total + c.value, 0)
  const result = Math.round((revenue - spent) * 100) / 100
  const scale = Math.max(revenue, spent)
  if (!scale) return <p className="chart-empty">{emptyText}</p>
  const pct = (v) => (v / scale) * 100
  const share = (v) => (revenue > 0 ? `${Math.round((v / revenue) * 100)}%` : '—')
  // Plain words for a share: "63 ETB of every 100 ETB sold"
  const per100 = (v) => (revenue > 0 ? Math.round((v / revenue) * 100) : null)
  const inWords = (r) => {
    const n = per100(r.value)
    if (n === null) return '—'
    return r.result && result < 0 ? `lost ${n} ETB for every 100 ETB sold` : `${n} ETB of every 100 ETB sold`
  }
  const segments = [...costs, ...(result > 0 ? [{ label: 'Net profit', value: result, tone: profitTone }] : [])].filter((s) => s.value > 0)
  const rows = [...costs, { label: result >= 0 ? 'Net profit' : 'Net loss', value: Math.abs(result), tone: result >= 0 ? profitTone : lossTone, result: true }]
  return (
    <div className="revenue-split">
      <p className="revenue-split-headline">
        {result >= 0
          ? <>You sold <strong>{format(revenue)}</strong> and kept <strong>{format(result)}</strong> as profit <span>({per100(result)} ETB of every 100 ETB sold)</span></>
          : <>Costs were <strong>{format(spent)}</strong>, more than the <strong>{format(revenue)}</strong> you sold: a loss of <strong>{format(-result)}</strong></>}
      </p>
      <div className="revenue-split-bar" role="img" aria-label={rows.map((r) => `${r.label} ${format(r.value)}`).join(', ')}>
        {segments.map((s) => (
          <span key={s.label} className={`revenue-split-segment tone-${s.tone}`} style={{ width: `${pct(s.value)}%` }} title={`${s.label}: ${format(s.value)} (${inWords(s)})`}>
            {pct(s.value) >= 9 && <em>{share(s.value)}</em>}
          </span>
        ))}
        {/* A loss: where revenue ran out */}
        {result < 0 && <span className="revenue-split-marker" style={{ left: `${pct(revenue)}%` }} />}
      </div>
      {/* …and a bracket under the costs past it: the loss */}
      {result < 0 && (
        <div className="revenue-split-under">
          <span className="revenue-split-ends" style={{ left: `${pct(revenue)}%` }}>Sales money runs out</span>
          <span className={`revenue-split-loss tone-${lossTone}`} style={{ left: `${pct(revenue)}%`, width: `${100 - pct(revenue)}%` }}>Loss {format(-result)}</span>
        </div>
      )}
      <table className="revenue-split-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.result ? 'result' : undefined}>
              <td><span className={`revenue-split-swatch tone-${r.tone}`} />{r.label}</td>
              <td className="num">{r.result && result < 0 ? '− ' : ''}{format(r.value)}</td>
              <td className="num share">{inWords(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Polar point on the pie, angle in turns (0 = 12 o'clock, clockwise)
const pointAt = (turn, r = 20) => [21 + r * Math.sin(turn * 2 * Math.PI), 21 - r * Math.cos(turn * 2 * Math.PI)]

/** Pie split into slices; `items` are { label, value, tone, detail? }, legend shows each value and its share */
export function PieChart({ items, format = (v) => v.toLocaleString(), emptyText }) {
  const shown = items.filter((i) => i.value > 0)
  const total = shown.reduce((t, i) => t + i.value, 0)
  // Each slice starts where the previous one ended
  const slices = shown.reduce((list, i) => {
    const start = list.length ? list[list.length - 1].end : 0
    return [...list, { ...i, start, end: start + i.value / total }]
  }, [])
  const share = (v) => `${Math.round((v / total) * 100)}%`
  return (
    <div className="donut-chart pie-chart">
      <svg viewBox="0 0 42 42" role="img" aria-label={total ? slices.map((s) => `${s.label}: ${format(s.value)} (${share(s.value)})`).join(', ') : emptyText}>
        {!total && <circle cx="21" cy="21" r="20" className="pie-empty" />}
        {slices.length === 1 && <circle cx="21" cy="21" r="20" className={`pie-slice tone-${slices[0].tone}`}><title>{`${slices[0].label}: ${format(slices[0].value)}`}</title></circle>}
        {slices.length > 1 && slices.map((s) => {
          const [x1, y1] = pointAt(s.start)
          const [x2, y2] = pointAt(s.end)
          return (
            <path key={s.label} className={`pie-slice tone-${s.tone}`} d={`M21 21 L${x1} ${y1} A20 20 0 ${s.end - s.start > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`}>
              <title>{`${s.label}: ${format(s.value)} (${share(s.value)})${s.detail ? ` · ${s.detail}` : ''}`}</title>
            </path>
          )
        })}
      </svg>
      {total ? (
        <ul className="chart-legend">
          {slices.map((s) => (
            <li key={s.label} title={s.detail ? `${s.label} · ${s.detail}` : s.label}>
              <span className={`legend-dot tone-${s.tone}`} />
              <span className="legend-label">{s.label}</span>
              <strong>{format(s.value)}</strong>
              <span className="legend-share">{share(s.value)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="chart-empty pie-empty-text">{emptyText}</p>}
    </div>
  )
}
