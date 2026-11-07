import { DateTime } from './index.js'

/**
 * Small ports of PHP / Laravel semantics the reports depend on, so figures, ordering and rounding come out exactly as
 * the Laravel app produced them.
 */

/** PHP's (float) cast: null, '' and non-numbers become 0; numeric strings from Postgres become numbers */
export function toFloat(value) {
  if (value === null || value === undefined || value === '' || value === false) return 0
  if (value === true) return 1
  const number = Number(value)
  return Number.isNaN(number) ? 0 : number
}

/** PHP's (int) cast: truncates toward zero */
export const toInt = (value) => Math.trunc(toFloat(value)) || 0

// Moves the decimal point through the string form, so 0.285 → 28.5 exactly (no binary multiplication error)
const shift = (number, places) => {
  const [mantissa, exponent = '0'] = String(number).split('e')
  return Number(`${mantissa}e${Number(exponent) + places}`)
}

/**
 * PHP's round($value, $precision): half away from zero, after PHP's pre-rounding to 15 significant digits, so
 * round(0.285, 2) is 0.29 in PHP (and here), where Math.round(0.285 * 100) / 100 gives 0.28.
 */
export function phpRound(value, precision = 0) {
  const number = toFloat(value)
  if (!Number.isFinite(number) || number === 0) return number === 0 ? 0 : number
  const pre = Math.abs(Number(number.toPrecision(15)))
  const rounded = shift(Math.round(shift(pre, precision)), -precision)
  return number < 0 && rounded !== 0 ? -rounded : rounded
}

/** PHP truthiness (Laravel's ->when($value) and `?:`): '', '0', 0, null, false and [] are false */
export function truthy(value) {
  if (value === null || value === undefined || value === false || value === '' || value === '0' || value === 0) return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

const NUMERIC = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/

/** PHP's is_numeric() */
export const isNumeric = (value) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && NUMERIC.test(value))

/**
 * PHP 8's `<=>` for the values reports sort by (strings, numbers, null): numeric strings compare as numbers, other
 * strings byte by byte (strcmp), null as '' against a string.
 */
export function phpCompare(a, b) {
  if (a === undefined) a = null
  if (b === undefined) b = null
  if (a === b) return 0
  if (a === null || b === null) {
    const other = a === null ? b : a
    const sign = a === null ? -1 : 1
    if (typeof other === 'string') return other === '' ? 0 : sign
    return Boolean(other) ? sign : 0
  }
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0
  if (isNumeric(a) && isNumeric(b)) {
    const [x, y] = [Number(a), Number(b)]
    return x < y ? -1 : x > y ? 1 : 0
  }
  const result = Buffer.compare(Buffer.from(String(a)), Buffer.from(String(b)))
  return result < 0 ? -1 : result > 0 ? 1 : 0
}

/**
 * Laravel's sortBy / sortByDesc (asort / arsort, SORT_REGULAR): stable, so equal items keep their order.
 * `key` is a property name or a function of the item.
 */
export function sortBy(items, key, descending = false) {
  const value = typeof key === 'function' ? key : (item) => item?.[key]
  return items
    .map((item, index) => ({ item, index, sortValue: value(item) }))
    .sort((x, y) => (descending ? phpCompare(y.sortValue, x.sortValue) : phpCompare(x.sortValue, y.sortValue)) || x.index - y.index)
    .map(({ item }) => item)
}

export const sortByDesc = (items, key) => sortBy(items, key, true)

/** Laravel's sortBy([[key, 'asc'], ...]): compares key after key until one differs */
export function sortByMany(items, comparisons) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((x, y) => {
      for (const [key, direction = 'asc'] of comparisons) {
        const result = direction === 'asc' ? phpCompare(x.item[key], y.item[key]) : phpCompare(y.item[key], x.item[key])
        if (result !== 0) return result
      }
      return x.index - y.index
    })
    .map(({ item }) => item)
}

/** Laravel's groupBy: a Map of key → items, in the order each key first appears */
export function groupBy(items, key) {
  const value = typeof key === 'function' ? key : (item) => item?.[key]
  const groups = new Map()
  for (const item of items) {
    const groupKey = value(item)
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey).push(item)
  }
  return groups
}

/** Laravel's collection sum(): adds from 0 in order */
export const sum = (items, key) => {
  const value = typeof key === 'function' ? key : (item) => item?.[key]
  return items.reduce((total, item) => total + toFloat(value(item)), 0)
}

/** A UTC timestamp as Laravel bound it to a query ('Y-m-d H:i:s': fractions of a second dropped) */
export function dbTime(value) {
  const millis = DateTime.isDateTime(value) ? value.toMillis() : value instanceof Date ? value.getTime() : Date.parse(value)
  return new Date(Math.floor(millis / 1000) * 1000)
}

/** Carbon's toIso8601String() in the value's own zone, e.g. '2026-11-05T13:15:00+03:00' */
export const isoInZone = (dateTime) => dateTime.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ")

/** A string as a SQL literal (for the store's time zone name, which Laravel also wrote into the SQL) */
export const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`

// Laravel's TrimStrings: whitespace plus BOM, zero-width space and left-to-right mark at either end
const TRIM = /^[ \t\n\r\v\f﻿​‎]+|[ \t\n\r\v\f﻿​‎]+$/g

/**
 * Laravel's global TrimStrings + ConvertEmptyStringsToNull middleware, applied to query strings and bodies alike:
 * strings are trimmed, and '' becomes null.
 */
export function cleanInput(value) {
  if (typeof value === 'string') {
    const trimmed = value.replace(TRIM, '')
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value)) return value.map(cleanInput)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanInput(item)]))
  return value
}

/** Builds positional parameters for a hand-written query: `where id = ${p.add(id)}` */
export class Params {
  values = []

  add(value) {
    this.values.push(value)
    return `$${this.values.length}`
  }
}
