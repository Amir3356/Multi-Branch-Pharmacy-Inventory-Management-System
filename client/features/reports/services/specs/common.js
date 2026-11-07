// Shared by the report descriptions (specs): how values are written, and the fixed chart colours.
// A spec is { cards, charts, tables }; the page and the PDF both draw it, so they always show the same figures.

// Categorical colours in fixed order (validated: neighbouring slices and bars stay distinct), then grey for "Other"
export const SERIES_TONES = ['role-1', 'role-2', 'role-3', 'role-4']
export const OTHER_TONE = 'slate'

export const count = (v) => Number(v || 0).toLocaleString('en-US')
export const percent = (v) => (v == null ? '—' : `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`)
export const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
export const date = (key) => (key ? new Date(`${key.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
// "Oct 12" on a day axis
export const dayLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * Slices for a pie or donut: the biggest few keep their own colour, the rest fold into "Other" (a fifth colour would be
 * hard to tell apart). `items` are { label, value }.
 */
export function foldSlices(items, keep = SERIES_TONES.length) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  const head = sorted.slice(0, keep).map((i, index) => ({ ...i, tone: SERIES_TONES[index] }))
  const rest = sorted.slice(keep)
  if (!rest.length) return head
  return [...head, { label: `Other (${rest.length})`, value: rest.reduce((t, i) => t + i.value, 0), tone: OTHER_TONE }]
}

/** One bar per day for a single measure, as a bar-chart spec */
export const dailyColumns = (daily, field) => daily.map((d) => ({ label: dayLabel(d.date), title: date(d.date), values: [d[field]] }))

/** A change against an earlier figure: "▲ 12% vs previous period", or null when there's nothing to compare */
export function change(now, before) {
  if (!before) return null
  const pct = ((now - before) / Math.abs(before)) * 100
  return { text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% vs previous period`, tone: pct >= 0 ? 'positive' : 'negative' }
}
