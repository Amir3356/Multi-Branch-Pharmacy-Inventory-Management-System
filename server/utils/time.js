import { DateTime } from 'luxon'
import { config } from '../config/index.js'

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

/** now() as Laravel stored it in a timestamp(0) column: whole seconds */
export const nowSeconds = () => new Date(Math.floor(Date.now() / 1000) * 1000)

/** A UTC timestamp as Date with fractions of a second dropped */
export function dbTime(value) {
  const millis = DateTime.isDateTime(value) ? value.toMillis() : value instanceof Date ? value.getTime() : Date.parse(value)
  return new Date(Math.floor(millis / 1000) * 1000)
}

/** ISO-8601 string in the value's own zone */
export const isoInZone = (dateTime) => dateTime.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ")

/** A timestamp shown as its date in the store's time zone */
export function localDate(value) {
  if (!value) return null
  return DateTime.fromJSDate(value instanceof Date ? value : new Date(value), { zone: 'utc' }).setZone(config.timezone).toISODate()
}


