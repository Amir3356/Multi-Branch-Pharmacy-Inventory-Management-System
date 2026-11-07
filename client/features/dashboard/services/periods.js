import { toDateKey, todayKey } from '../../../utils'

// The periods the dashboard can show; each runs up to today
export const PERIODS = {
  daily: 'Today',
  monthly: 'This Month',
  quarterly: 'This Quarter',
  yearly: 'This Year',
  custom: 'Custom Date Range'
}

/** First and last day (YYYY-MM-DD, inclusive) of a period; custom uses the given dates */
export function periodRange(period, from, to) {
  const today = new Date()
  const key = todayKey()
  if (period === 'custom') return [from || key, to || key]
  if (period === 'weekly') {
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return [toDateKey(monday), key]
  }
  if (period === 'monthly') return [`${key.slice(0, 7)}-01`, key]
  if (period === 'quarterly') {
    // Calendar quarters: Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec
    const firstMonth = Math.floor(today.getMonth() / 3) * 3 + 1
    return [`${key.slice(0, 4)}-${String(firstMonth).padStart(2, '0')}-01`, key]
  }
  if (period === 'yearly') return [`${key.slice(0, 4)}-01-01`, key]
  return [key, key]
}

/** "Oct 1 – Oct 9, 2026", or a single day */
export function periodLabel(from, to) {
  const fmt = (k) => new Date(`${k}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
}

export const inPeriod = (dateKey, [from, to]) => dateKey >= from && dateKey <= to
