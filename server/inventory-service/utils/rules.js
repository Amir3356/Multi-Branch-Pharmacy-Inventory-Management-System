import { validationError, z } from './index.js'

/**
 * Laravel-style field rules on top of zod, for request bodies whose messages must match the PHP FormRequests exactly.
 * Like Laravel: a failed `required` stops that field's other rules; otherwise every failing rule adds its message;
 * an absent or null field without `required` skips its rules (nullable); and `after` hooks run even when rules failed.
 * Async rules (exists) are supported, which common's validate() (sync safeParse) can't do.
 *
 *   await validateRules({ qty: [required(), integer(), min(1)] }, req.body)
 */

const isEmpty = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)

/** Laravel's TrimStrings + ConvertEmptyStringsToNull global middleware */
export function normalizeInput(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value)) return value.map(normalizeInput)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeInput(v)]))
  return value
}

/** PHP is_numeric: numbers, and numeric strings (optional sign, decimals, exponent) */
export const isNumeric = (value) =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(value))

/** PHP filter_var(FILTER_VALIDATE_INT), as Laravel's `integer` rule uses it */
export const isInteger = (value) =>
  (typeof value === 'number' && Number.isInteger(value)) || (typeof value === 'string' && /^[+-]?(0|[1-9]\d*)$/.test(value))

/** date_format:Y-m-d: the exact format and a real calendar day (2026-02-30 fails, as PHP's round trip check does) */
export const isYmd = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Laravel's getSize(): the number itself for numeric fields, otherwise the length
const size = (value, numericField) => {
  if (numericField && isNumeric(value)) return Number(value)
  if (Array.isArray(value)) return value.length
  return [...String(value)].length
}

// ---- Rules: { check(value, data, ctx), message(label, ctx) | string, implicit?, numeric? } ----

export const required = (message) => ({ implicit: true, check: (v) => !isEmpty(v), message: message ?? ((a) => `The ${a} field is required.`) })

export const string = (message) => ({ check: (v) => typeof v === 'string', message: message ?? ((a) => `The ${a} field must be a string.`) })

export const integer = (message) => ({ numeric: true, check: isInteger, message: message ?? ((a) => `The ${a} field must be an integer.`) })

export const numeric = (message) => ({ numeric: true, check: isNumeric, message: message ?? ((a) => `The ${a} field must be a number.`) })

export const min = (n, message) => ({
  check: (v, data, ctx) => size(v, ctx.numeric) >= n,
  message: message ?? ((a, ctx) => (ctx.numeric ? `The ${a} field must be at least ${n}.` : `The ${a} field must be at least ${n} characters.`)),
})

export const max = (n, message) => ({
  check: (v, data, ctx) => size(v, ctx.numeric) <= n,
  message: message ?? ((a, ctx) => (ctx.numeric ? `The ${a} field must not be greater than ${n}.` : `The ${a} field must not be greater than ${n} characters.`)),
})

export const gt = (n, message) => ({
  check: (v, data, ctx) => size(v, ctx.numeric) > n,
  message: message ?? ((a, ctx) => (ctx.numeric ? `The ${a} field must be greater than ${n}.` : `The ${a} field must be greater than ${n} characters.`)),
})

export const dateFormatYmd = (message) => ({ check: isYmd, message: message ?? ((a) => `The ${a} field must match the format Y-m-d.`) })

export const oneOf = (values, message) => ({ check: (v) => values.includes(v), message: message ?? ((a) => `The selected ${a} is invalid.`) })

export const different = (other, message) => ({
  check: (v, data) => v !== data[other],
  message: message ?? ((a) => `The ${a} field and ${other} must be different.`),
})

/** exists / closure rules: check(value, data) may be async */
export const rule = (check, message) => ({ check, message })

/**
 * Validates `body` against { field: [rules] }. Default messages name the field as Laravel does (medId → "med id");
 * `after(data, errors)` may add more messages, as FormRequest::after() does.
 * Returns the normalized data of the validated fields; throws a Laravel-shaped 422.
 */
export async function validateRules(definition, body, { after } = {}) {
  const data = normalizeInput(body && typeof body === 'object' && !Array.isArray(body) ? body : {})

  const schema = z.looseObject({}).superRefine(async (input, ctx) => {
    for (const [field, rules] of Object.entries(definition)) {
      const value = input[field]
      const fieldCtx = { numeric: rules.some((r) => r.numeric) }
      const implicit = rules.some((r) => r.implicit)
      // Not required and missing or null: nothing to check (nullable / sometimes)
      if (!implicit && (value === undefined || value === null)) continue

      for (const r of rules) {
        if (await r.check(value, input, fieldCtx)) continue
        const label = labelFor(field)
        ctx.addIssue({ code: 'custom', path: [field], message: typeof r.message === 'function' ? r.message(label, fieldCtx) : r.message })
        if (r.implicit) break
      }
    }
  })

  const result = await schema.safeParseAsync(data)
  const errors = {}
  for (const issue of result.success ? [] : result.error.issues) {
    const field = issue.path.join('.') || 'input'
    errors[field] ??= []
    if (!errors[field].includes(issue.message)) errors[field].push(issue.message)
  }
  if (after) await after(data, errors)
  if (Object.keys(errors).length) throw validationError(errors)

  return Object.fromEntries(Object.keys(definition).filter((field) => field in data).map((field) => [field, data[field]]))
}

/** Adds a message the way Laravel's $validator->errors()->add() does */
export const addError = (errors, field, message) => {
  errors[field] ??= []
  errors[field].push(message)
}

// Laravel's attribute name in default messages: Str::snake, underscores as spaces (expectedStock → "expected stock")
const labelFor = (field) => field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/_/g, ' ')
