import { validate, z } from '../utils/index.js'

/**
 * Laravel-style validation on top of common's validate(): each field's rules run in order, every failing rule adds its
 * message (no bail), a failed required rule stops that field, and non-required rules skip empty values, exactly as
 * Laravel's Validator did. Database facts (unique, exists) are looked up by the caller first and passed in as plain
 * tests, so one 422 still lists every field's errors in rule order.
 *
 *   validateRules({ email: { sometimes: true, rules: [rule.required(), rule.email()] } }, input)
 */

/** Laravel's displayable attribute: 'fullName' → 'full name' (Str::snake, underscores to spaces) */
export const label = (field) => field.replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase().replaceAll('_', ' ')

const blank = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)

const size = (value) => (Array.isArray(value) ? value.length : [...String(value)].length)

const scalar = (value) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

// RFC 5322 dot-atom addresses (Laravel's email:rfc); a domain without a dot, such as "localhost", is valid there too
const EMAIL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*$/

const make = (test, fallback, message, implicit = false) => ({ test, implicit, message: message ?? fallback })

/** Rules with Laravel's default English messages; pass a message to override (FormRequest::messages) */
export const rule = {
  required: (message) => make((value) => !blank(value), (field) => `The ${label(field)} field is required.`, message, true),
  /** required_if / Rule::requiredIf: required only while when(data) is true */
  requiredIf: (when, message) => make((value, data) => !when(data) || !blank(value), (field) => `The ${label(field)} field is required.`, message, true),
  string: (message) => make((value) => typeof value === 'string', (field) => `The ${label(field)} field must be a string.`, message),
  max: (max, message) => make((value) => size(value) <= max, (field) => `The ${label(field)} field must not be greater than ${max} characters.`, message),
  email: (message) =>
    make((value) => typeof value === 'string' && EMAIL.test(value) && value.split('@')[0].length <= 64, (field) => `The ${label(field)} field must be a valid email address.`, message),
  in: (values, message) => make((value) => scalar(value) && values.includes(String(value)), (field) => `The selected ${label(field)} is invalid.`, message),
  /** Must equal `<field>_confirmation`, strictly (Laravel's `same`); validateRules supplies the field name */
  confirmed: (message) => ({ confirmed: true, implicit: false, message: message ?? ((field) => `The ${label(field)} field confirmation does not match.`) }),
  /** A check worked out by the caller (unique, exists, …): passes when test(value, data) is true */
  check: (test, message) => make(test, (field) => `The ${label(field)} field is invalid.`, message),
}

/**
 * Validates `data` against `spec` ({ field: { sometimes?, nullable?, rules: [...] } }) and returns data, or throws the
 * Laravel-shaped 422 through common's validate().
 */
export function validateRules(spec, data) {
  const schema = z.any().superRefine((input, ctx) => {
    for (const [field, { sometimes = false, nullable = false, rules }] of Object.entries(spec)) {
      const present = Object.hasOwn(input, field)
      if (sometimes && !present) continue
      const value = input[field]
      for (const current of rules) {
        if (!current.implicit) {
          // Laravel runs only "implicit" (required) rules on an empty string or a missing field, and none on a null
          // marked nullable
          if (typeof value === 'string' && value.trim() === '') continue
          if (!present) continue
          if (nullable && value === null) continue
        }
        const passes = current.confirmed ? value === input[`${field}_confirmation`] : current.test(value, input)
        if (passes) continue
        ctx.addIssue({ code: 'custom', path: [field], message: typeof current.message === 'function' ? current.message(field) : current.message })
        if (current.implicit) break
      }
    }
  })
  validate(schema, data)
  return data
}

/**
 * Laravel's TrimStrings + ConvertEmptyStringsToNull middleware for the top-level body fields: strings are trimmed
 * (passwords are not) and empty strings become null.
 */
export function normalizeInput(body, keepRaw = ['password', 'password_confirmation', 'current_password']) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? { ...body } : {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string') continue
    const next = keepRaw.includes(key) ? value : value.trim()
    input[key] = next === '' ? null : next
  }
  return input
}

/** PHP's (string) cast for request values: null → '' */
export const str = (value) => (value === null || value === undefined ? '' : String(value))
