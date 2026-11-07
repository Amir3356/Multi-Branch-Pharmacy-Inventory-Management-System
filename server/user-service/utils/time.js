import { DateTime } from 'luxon'
import { config } from './config.js'

export { DateTime }

/** Now in the store's time zone (STORE_TIMEZONE): report periods like "today" follow it */
export const storeNow = () => DateTime.now().setZone(config.timezone)

/** Today's date in the store's time zone, 'YYYY-MM-DD' */
export const storeToday = () => storeNow().toISODate()

const toDateTime = (value) => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return DateTime.fromJSDate(value, { zone: 'utc' })
  if (DateTime.isDateTime(value)) return value.toUTC()
  return DateTime.fromISO(String(value), { zone: 'utc' })
}

/** Laravel's toIso8601String(): '2026-11-05T10:15:00+00:00' (UTC), or null */
export function iso8601(value) {
  const dt = toDateTime(value)
  return dt?.isValid ? dt.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ssZZ") : null
}

/** How Laravel serialized model timestamps by default: '2026-11-05T10:15:00.000000Z', or null */
export function serializeDate(value) {
  const dt = toDateTime(value)
  return dt?.isValid ? dt.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'000Z'") : null
}

/** A date column ('YYYY-MM-DD') shown like Carbon's format('M j, Y'): 'Nov 5, 2026' */
export function formatDate(value) {
  if (!value) return null
  const dt = typeof value === 'string' && value.length === 10 ? DateTime.fromISO(value) : toDateTime(value)
  return dt?.isValid ? dt.toFormat('LLL d, yyyy') : null
}
