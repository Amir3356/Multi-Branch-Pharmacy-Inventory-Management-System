/**
 * Standard JavaScript helpers for type conversions, sorting, grouping, and sanitization.
 */

/** Converts value to float/number: null, undefined, '', false become 0 */
export function toFloat(value) {
  if (value === null || value === undefined || value === '' || value === false) return 0
  if (value === true) return 1
  const number = Number(value)
  return Number.isNaN(number) ? 0 : number
}

/** Converts value to integer: truncates toward zero */
export const toInt = (value) => Math.trunc(toFloat(value)) || 0

// Exponential notation shift to avoid floating point precision issues
const shift = (number, places) => {
  const [mantissa, exponent = '0'] = String(number).split('e')
  return Number(`${mantissa}e${Number(exponent) + places}`)
}

/**
 * Rounds a number to a specified number of decimal places.
 */
export function round(value, precision = 0) {
  const number = toFloat(value)
  if (!Number.isFinite(number) || number === 0) return number === 0 ? 0 : number
  const pre = Math.abs(Number(number.toPrecision(15)))
  const rounded = shift(Math.round(shift(pre, precision)), -precision)
  return number < 0 && rounded !== 0 ? -rounded : rounded
}

/** Check if a value is truthy (null, undefined, false, '', '0', 0, [] are falsy) */
export function isTruthy(value) {
  if (value === null || value === undefined || value === false || value === '' || value === '0' || value === 0) return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

export const truthy = isTruthy

const NUMERIC = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/

/** Check if a value is numeric */
export const isNumeric = (value) =>
  (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && NUMERIC.test(value))

/** Compares two values for sorting */
export function compareValues(a, b) {
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

/** Sort an array of items by key or extractor function */
export function sortBy(items, key, descending = false) {
  const value = typeof key === 'function' ? key : (item) => item?.[key]
  return items
    .map((item, index) => ({ item, index, sortValue: value(item) }))
    .sort((x, y) => (descending ? compareValues(y.sortValue, x.sortValue) : compareValues(x.sortValue, y.sortValue)) || x.index - y.index)
    .map(({ item }) => item)
}

export const sortByDesc = (items, key) => sortBy(items, key, true)

/** Sort by multiple comparisons */
export function sortByMany(items, comparisons) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((x, y) => {
      for (const [key, direction = 'asc'] of comparisons) {
        const result = direction === 'asc' ? compareValues(x.item[key], y.item[key]) : compareValues(y.item[key], x.item[key])
        if (result !== 0) return result
      }
      return x.index - y.index
    })
    .map(({ item }) => item)
}

/** Group an array of items into a Map */
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

/** Sum values in an array */
export const sum = (items, key) => {
  const value = typeof key === 'function' ? key : (item) => item?.[key]
  return items.reduce((total, item) => total + toFloat(value(item)), 0)
}

const TRIM_REGEX = /^[ \t\n\r\v\f﻿​‎]+|[ \t\n\r\v\f﻿​‎]+$/g

/** Clean and trim input, converting empty strings to null */
export function cleanInput(value) {
  if (typeof value === 'string') {
    const trimmed = value.replace(TRIM_REGEX, '')
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value)) return value.map(cleanInput)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, item]) => [k, cleanInput(item)]))
  }
  return value
}

export const normalizeInput = cleanInput

/** Coerce value to string cleanly */
export function toCleanString(value) {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return '1'
  if (typeof value === 'object') return ''
  return String(value)
}

/** Check if a string is empty or '0' */
export const isFalsyString = (value) => value === '' || value === '0'

/** Capitalize first letter */
export const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '')

/** Escapes SQL string literal */
export const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`

export const rawurlencode = (value) => encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
