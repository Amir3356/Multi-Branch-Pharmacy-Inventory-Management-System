import { config } from './config.js'
import { DateTime } from './time.js'

/** Now in the store's local time, so "today" matches the clock on the wall */
export const localNow = () => DateTime.now().setZone(config.timezone)

/** A date string as Laravel's `date` rule and Carbon::parse read it, in `zone`; null when it isn't one */
export function parseDate(value, zone) {
  if (typeof value !== 'string') return null
  for (const parse of ['fromISO', 'fromSQL', 'fromRFC2822']) {
    const parsed = DateTime[parse](value, { zone })
    if (parsed.isValid) return parsed
  }
  return null
}
