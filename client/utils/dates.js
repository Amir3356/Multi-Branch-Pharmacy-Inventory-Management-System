// Date helpers shared across the app. Dates are local calendar days (YYYY-MM-DD).

/** Local calendar date as YYYY-MM-DD */
export const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const todayKey = () => toDateKey(new Date())

export const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const daysUntil = (date) => Math.round((date - startOfToday()) / (1000 * 60 * 60 * 24))

export const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** Formats a calendar date (YYYY-MM-DD string or Date) as DD/MM/YYYY (date/month/year) */
export const formatDMY = (date) => {
  if (!date) return '—'
  if (typeof date === 'string') {
    const parts = date.split('-')
    if (parts.length === 3 && parts[0].length === 4) {
      const [year, month, day] = parts
      return `${day}/${month}/${year}`
    }
  }
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return String(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export const minutesBetween = (later, earlier) => {
  if (!later || !earlier) return 0
  const l = later instanceof Date ? later.getTime() : typeof later === 'string' ? new Date(later).getTime() : Number(later)
  const e = earlier instanceof Date ? earlier.getTime() : typeof earlier === 'string' ? new Date(earlier).getTime() : Number(earlier)
  if (Number.isNaN(l) || Number.isNaN(e)) return 0
  return Math.max(0, Math.round((l - e) / 60000))
}

export const timeAgo = (date, now) => {
  const minutes = minutesBetween(now, date)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

/** "Today 09:38" or "Oct 4 09:38" */
export const formatSessionTime = (date, now) => {
  const time = formatTime(date)
  return toDateKey(date) === toDateKey(now) ? `Today ${time}` : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}

/** "14:05": the time of day, 24-hour */
export const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
