import { one, validationError } from './index.js'
import { isNumeric } from './php.js'

/**
 * Laravel's validator for query strings, with its rule order and messages. Query strings don't suit zod here because
 * Laravel keeps validating a field after a non-required rule fails (a bad `to` gets both the date-format and the
 * end-date message) and skips non-required rules for missing or nullable-and-null values.
 *
 *   await validateInput(cleanInput(req.query), { from: [required('from'), dateFormat('from')], branchId: [NULLABLE, ...] })
 */

export const NULLABLE = Symbol('nullable')

// Laravel shows camelCase fields in messages through Str::snake: branchId → "branch id"
const label = (field) => field.replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase().replace(/_/g, ' ')

const isEmpty = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)

export const required = (field) => ({ implicit: true, test: (value) => !isEmpty(value), message: `The ${label(field)} field is required.` })

export const string = (field) => ({ test: (value) => typeof value === 'string', message: `The ${label(field)} field must be a string.` })

// date_format:Y-m-d: DateTime::createFromFormat('!Y-m-d', $value) must give back exactly the same string
const isYmd = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCFullYear(year)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export const dateFormat = (field) => ({ test: isYmd, message: `The ${label(field)} field must match the format Y-m-d.` })

/**
 * How after_or_equal reads a date: createFromFormat('!Y-m-d') (which lets days and months overflow), else PHP's
 * date_create(). The fallback is approximated with Date.parse; it only decides whether a value that already failed
 * date_format also gets the end-date message.
 */
function parseLenient(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value)
  const match = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    return date.getTime()
  }
  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? null : parsed
}

/** after_or_equal:other, with Laravel's rule: passes when the other field is missing */
export const afterOrEqual = (other, message) => ({
  test: (value, data) => {
    if (typeof value !== 'string' && typeof value !== 'number') return false
    const first = parseLenient(value)
    const otherValue = data[other]
    if (otherValue === null || otherValue === undefined) return true
    const second = parseLenient(otherValue)
    return first !== null && second !== null && first >= second
  },
  message,
})

// Laravel's size: a number for numeric rules, a count for arrays, otherwise the string length
const size = (value, numeric) => (numeric && isNumeric(value) ? Number(value) : Array.isArray(value) ? value.length : [...String(value ?? '')].length)

export const max = (field, limit) => ({ test: (value) => size(value, false) <= limit, message: `The ${label(field)} field must not be greater than ${limit} characters.` })

export const integer = (field) => ({
  // filter_var(FILTER_VALIDATE_INT): optional sign, no leading zeros, surrounding whitespace allowed
  test: (value) => (typeof value === 'number' ? Number.isInteger(value) : typeof value === 'string' && /^[ \t\n\r\v\f]*[+-]?(0|[1-9]\d*)[ \t\n\r\v\f]*$/.test(value)),
  message: `The ${label(field)} field must be an integer.`,
})

/** min for a field that also has a numeric rule (integer) */
export const minNumber = (field, limit) => ({ test: (value) => size(value, true) >= limit, message: `The ${label(field)} field must be at least ${limit}.` })

export const inList = (field, list) => ({
  test: (value) => !Array.isArray(value) && value !== null && typeof value !== 'object' && list.includes(String(value)),
  message: `The selected ${label(field)} is invalid.`,
})

/** exists:table,column (skipped once the field has another error, as Laravel does) */
export const exists = (field, table, column) => ({
  skipIfFailed: true,
  test: async (value) => Boolean(await one(`select 1 from ${table} where ${column} = $1 limit 1`, [String(value)])),
  message: `The selected ${label(field)} is invalid.`,
})

/** Runs the rules field by field; returns the validated fields or throws Laravel's 422 */
export async function validateInput(data, spec) {
  const errors = {}
  const validated = {}
  for (const [field, rules] of Object.entries(spec)) {
    const present = Object.hasOwn(data, field) && data[field] !== undefined
    const value = present ? data[field] : undefined
    const nullable = rules.includes(NULLABLE)
    for (const rule of rules) {
      if (rule === NULLABLE) continue
      if (!present && !rule.implicit) continue
      if (nullable && value === null) continue
      if (rule.skipIfFailed && errors[field]) continue
      if (!(await rule.test(value, data))) {
        ;(errors[field] ??= []).push(rule.message)
        // A failed required rule stops the field's other rules
        if (rule.implicit) break
      }
    }
    if (present) validated[field] = value
  }
  if (Object.keys(errors).length) throw validationError(errors)
  return validated
}
