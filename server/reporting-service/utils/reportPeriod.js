import { DateTime, config } from './index.js'
import { Params, dbTime, isoInZone, sqlString, truthy } from './php.js'

/**
 * A report's period (calendar days in the store's time zone) and optional branch. Timestamps are stored in UTC, so a
 * period's days become a UTC range; date columns (expense dates, damage dates) compare by date.
 *
 * timestamps() / dates() return a { sql, values } condition whose placeholders start at $1; a query that needs more
 * parameters adds them after `values`.
 */
export class ReportPeriod {
  constructor(from, to, branchId) {
    this.from = from
    this.to = to
    this.branchId = branchId ?? null
    this.zone = config.timezone
    this.start = DateTime.fromISO(from, { zone: this.zone }).startOf('day').toUTC()
    this.end = DateTime.fromISO(to, { zone: this.zone }).endOf('day').toUTC()
  }

  /** Rows whose timestamp column falls in the period, and in the branch when one is chosen */
  timestamps(column, branchColumn = 'branch_id') {
    return this.#condition(column, dbTime(this.start), dbTime(this.end), branchColumn)
  }

  /** Rows whose date column falls in the period, and in the branch when one is chosen */
  dates(column, branchColumn = 'branch_id') {
    return this.#condition(column, this.from, this.to, branchColumn)
  }

  #condition(column, low, high, branchColumn) {
    const p = new Params()
    let sql = `${column} between ${p.add(low)} and ${p.add(high)}`
    if (truthy(this.branchId) && branchColumn) sql += ` and ${branchColumn} = ${p.add(this.branchId)}`
    return { sql, values: p.values }
  }

  /** The store's calendar day of a UTC timestamp column, as YYYY-MM-DD */
  localDay(column) {
    return `to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${sqlString(this.zone)}, 'YYYY-MM-DD')`
  }

  /** A UTC timestamp as the store's local time, ISO 8601 */
  local(timestamp) {
    if (!timestamp) return null
    const value = timestamp instanceof Date ? DateTime.fromJSDate(timestamp) : DateTime.fromISO(String(timestamp).replace(' ', 'T'), { zone: 'utc' })
    return isoInZone(value.setZone(this.zone))
  }
}
