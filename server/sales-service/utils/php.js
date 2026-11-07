import { DateTime, HttpError, config } from './index.js'

/**
 * Small PHP/Laravel behaviours the old code relied on implicitly, so responses and stored values stay identical.
 */

// Laravel's TrimStrings + ConvertEmptyStringsToNull global middleware: every string input is trimmed, '' becomes null
const TRIM = /^[\s﻿​‎]+|[\s﻿​‎]+$/g
export function normalizeInput(value) {
  if (typeof value === 'string') {
    const trimmed = value.replace(TRIM, '')
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value)) return value.map(normalizeInput)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeInput(v)]))
  return value
}

/** PHP's (string) cast */
export function phpString(value) {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return '1'
  if (typeof value === 'object') return 'Array'
  return String(value)
}

/** PHP's truthiness of a string ("" and "0" are falsy), for `trim(...) ?: default` */
export const phpFalsyString = (value) => value === '' || value === '0'

/** PHP's (int) cast */
export function phpInt(value) {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0
  if (typeof value === 'string') return Math.trunc(Number.parseFloat(value)) || 0
  return 0
}

/** PHP's round($value, $precision): half away from zero, with PHP's pre-rounding (round(1.005, 2) = 1.01) */
export function phpRound(value, precision = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const factor = 10 ** precision
  const shifted = Number((Math.abs(n) * factor).toPrecision(15))
  return (Math.sign(n) || 1) * (Math.round(shifted) / factor)
}

export const ucfirst = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value)

/** A timestamp shown as its date in the store's time zone (Carbon ->setTimezone(...)->toDateString()) */
export function localDate(value) {
  if (!value) return null
  return DateTime.fromJSDate(value instanceof Date ? value : new Date(value), { zone: 'utc' }).setZone(config.timezone).toISODate()
}

/** now() as Laravel stored it in a timestamp(0) column: whole seconds */
export const nowSeconds = () => new Date(Math.floor(Date.now() / 1000) * 1000)

/** Laravel's route-model binding miss: 404 "No query results for model [App\…\Expense] EXP-00001" */
export const modelNotFound = (model, id) => new HttpError(404, `No query results for model [${model}] ${id}`)
