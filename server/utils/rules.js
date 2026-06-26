import { validationError } from './index.js'

/**
 * Laravel-style field rules on top of zod.
 * Supports both inventory-service style and user/branch-service style.
 */

const isEmpty = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)

export const blank = isEmpty

/** Laravel's TrimStrings + ConvertEmptyStringsToNull global middleware */
export function normalizeInput(value, keepRaw = ['password', 'password_confirmation', 'current_password']) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value)) return value.map((v) => normalizeInput(v, keepRaw))
  if (value && typeof value === 'object') {
    const input = { ...value }
    for (const [k, v] of Object.entries(input)) {
      if (typeof v !== 'string') continue
      const next = keepRaw.includes(k) ? v : v.trim()
      input[k] = next === '' ? null : next
    }
    return input
  }
  return value
}

/** PHP is_numeric: numbers, and numeric strings */
export const isNumeric = (value) =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(value))

/** PHP filter_var(FILTER_VALIDATE_INT) */
export const isInteger = (value) =>
  (typeof value === 'number' && Number.isInteger(value)) || (typeof value === 'string' && /^[+-]?(0|[1-9]\d*)$/.test(value))

/** date_format:Y-m-d */
export const isYmd = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Laravel's displayable attribute: medId -> med id
export const label = (field) => field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/_/g, ' ')

const sizeOf = (value, numericField) => {
  if (numericField && isNumeric(value)) return Number(value)
  if (Array.isArray(value)) return value.length
  return [...String(value ?? '')].length
}

const scalar = (value) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
export const EMAIL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*$/

// Standalone rules for inventory-service
export const required = (message) => ({
  implicit: true,
  check: (v) => !isEmpty(v),
  test: (v) => !isEmpty(v),
  message: message ?? ((a) => `The ${label(a)} field is required.`),
})

export const string = (message) => ({
  check: (v) => typeof v === 'string',
  test: (v) => typeof v === 'string',
  message: message ?? ((a) => `The ${label(a)} field must be a string.`),
})

export const integer = (message) => ({
  numeric: true,
  check: isInteger,
  test: isInteger,
  message: message ?? ((a) => `The ${label(a)} field must be an integer.`),
})

export const numeric = (message) => ({
  numeric: true,
  check: isNumeric,
  test: isNumeric,
  message: message ?? ((a) => `The ${label(a)} field must be a number.`),
})

export const min = (n, message) => ({
  check: (v, data, ctx) => sizeOf(v, ctx?.numeric) >= n,
  test: (v) => sizeOf(v, true) >= n,
  message: message ?? ((a, ctx) => (ctx?.numeric ? `The ${label(a)} field must be at least ${n}.` : `The ${label(a)} field must be at least ${n} characters.`)),
})

export const max = (n, message) => ({
  check: (v, data, ctx) => sizeOf(v, ctx?.numeric) <= n,
  test: (v) => sizeOf(v, false) <= n,
  message: message ?? ((a, ctx) => (ctx?.numeric ? `The ${label(a)} field must not be greater than ${n}.` : `The ${label(a)} field must not be greater than ${n} characters.`)),
})

export const gt = (n, message) => ({
  check: (v, data, ctx) => sizeOf(v, ctx?.numeric) > n,
  test: (v) => sizeOf(v, true) > n,
  message: message ?? ((a, ctx) => (ctx?.numeric ? `The ${label(a)} field must be greater than ${n}.` : `The ${label(a)} field must be greater than ${n} characters.`)),
})

export const dateFormatYmd = (message) => ({
  check: isYmd,
  test: isYmd,
  message: message ?? ((a) => `The ${label(a)} field must match the format Y-m-d.`),
})

export const oneOf = (values, message) => ({
  check: (v) => values.includes(v),
  test: (v) => values.includes(v),
  message: message ?? ((a) => `The selected ${label(a)} is invalid.`),
})

export const different = (other, message) => ({
  check: (v, data) => v !== data[other],
  test: (v, data) => v !== data[other],
  message: message ?? ((a) => `The ${label(a)} field and ${other} must be different.`),
})

export const addError = (errors, field, message) => {
  errors[field] ??= []
  errors[field].push(message)
}

const makeRule = (test, fallback, message, implicit = false) => ({
  test,
  check: test,
  implicit,
  message: message ?? fallback,
})

// rule function (inventory-service) and object (user-service) combined
export const rule = Object.assign(
  function ruleFn(check, message) {
    return { check, test: check, message }
  },
  {
    required: (message) => required(message),
    requiredIf: (when, message) => ({
      implicit: true,
      check: (v, data) => !when(data) || !isEmpty(v),
      test: (v, data) => !when(data) || !isEmpty(v),
      message: message ?? ((f) => `The ${label(f)} field is required.`),
    }),
    string: (message) => string(message),
    max: (maxVal, message) => max(maxVal, message),
    email: (message) =>
      makeRule(
        (v) => typeof v === 'string' && EMAIL.test(v) && v.split('@')[0].length <= 64,
        (f) => `The ${label(f)} field must be a valid email address.`,
        message,
      ),
    in: (values, message) =>
      makeRule(
        (v) => scalar(v) && values.includes(String(v)),
        (f) => `The selected ${label(f)} is invalid.`,
        message,
      ),
    confirmed: (message) => ({
      confirmed: true,
      implicit: false,
      message: message ?? ((f) => `The ${label(f)} field confirmation does not match.`),
    }),
    check: (test, message) => makeRule(test, (f) => `The ${label(f)} field is invalid.`, message),
  },
)

export const str = (value) => (value === null || value === undefined ? '' : String(value))

/**
 * Validates data against rules definition. Supports both inventory and user definitions.
 */
export async function validateRules(definition, body, { after } = {}) {
  const data = normalizeInput(body && typeof body === 'object' && !Array.isArray(body) ? body : {})

  const errors = {}
  const add = (field, message) => {
    errors[field] ??= []
    if (!errors[field].includes(message)) errors[field].push(message)
  }

  for (const [field, spec] of Object.entries(definition)) {
    const isArrayRules = Array.isArray(spec)
    const sometimes = !isArrayRules && Boolean(spec.sometimes)
    const rules = isArrayRules ? spec : spec.rules || []

    const present = Object.hasOwn(data, field)
    if (sometimes && !present) continue
    const value = data[field]

    const fieldCtx = { numeric: rules.some((r) => r.numeric) }
    const implicit = rules.some((r) => r.implicit)

    const empty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
    if (!implicit && empty) {
      continue
    }

    for (const r of rules) {
      // An empty value only answers to the "required"-type rules: string, max, etc. don't apply to nothing
      // (e.g. a Purchase Officer's branchId: null passes "required unless all branches" and skips "must be a string")
      if (empty && !r.implicit) continue
      let passes = true
      if (typeof r === 'function') {
        passes = await r(value, data, fieldCtx)
      } else if (r.confirmed) {
        passes = value === data[`${field}_confirmation`]
      } else if (r.check) {
        passes = await r.check(value, data, fieldCtx)
      } else if (r.test) {
        passes = await r.test(value, data)
      }

      if (!passes) {
        const msg = typeof r.message === 'function' ? r.message(label(field), fieldCtx) : r.message || `The ${label(field)} field is invalid.`
        add(field, msg)
        if (r.implicit || implicit) break
      }
    }
  }

  if (after) await after(data, errors)
  if (Object.keys(errors).length) throw validationError(errors)

  return data
}
