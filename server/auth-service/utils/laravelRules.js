import { z } from './validate.js'

/**
 * The few Laravel validation rules these requests use, with Laravel's messages and its order of checks: fields in
 * rule order; a failed `required` stops that field; other rules skip an empty value; `nullable` skips null.
 *
 *   validate(laravelRules({ email: ['required', 'email'], password: ['required', 'string'] }), body)
 */
export function laravelRules(spec) {
  return z.looseObject({}).superRefine((data, ctx) => {
    for (const [field, rules] of Object.entries(spec)) {
      for (const message of check(field, data[field], rules, data)) ctx.addIssue({ code: 'custom', path: [field], message })
    }
  })
}

/** PHP's is_numeric */
export function isNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/.test(value)
}

const isBlank = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)

// Laravel's default `email` rule (RFC validation) is lenient: one @, nothing empty, no spaces
const isEmail = (value) => {
  if (typeof value !== 'string') return false
  const at = value.lastIndexOf('@')
  if (at < 1 || at === value.length - 1) return false
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  return !/[\s"(),:;<>[\]\\@]/.test(local) && !/[\s"(),:;<>[\]\\@]/.test(domain) && !/^\.|\.$|\.\./.test(local) && !/^[.-]|[.-]$|\.\./.test(domain)
}

function check(field, value, rules, data) {
  const messages = []
  const numeric = rules.includes('numeric')
  // Laravel's getSize: a number for numeric fields, otherwise the length
  const size = () => (numeric && isNumeric(value) ? Number(value) : Array.isArray(value) ? value.length : [...String(value)].length)
  const unit = numeric ? '' : ' characters'

  for (const rule of rules) {
    const [name, arg] = rule.split(':')
    if (name === 'required') {
      if (isBlank(value)) return [`The ${field} field is required.`]
      continue
    }
    if (name === 'nullable') {
      if (value === null || value === undefined) return []
      continue
    }
    if (isBlank(value) && !(Array.isArray(value) && value.length === 0)) continue

    if (name === 'string' && typeof value !== 'string') messages.push(`The ${field} field must be a string.`)
    if (name === 'email' && !isEmail(value)) messages.push(`The ${field} field must be a valid email address.`)
    if (name === 'numeric' && !isNumeric(value)) messages.push(`The ${field} field must be a number.`)
    if (name === 'max' && size() > Number(arg)) messages.push(`The ${field} field must not be greater than ${arg}${unit}.`)
    if (name === 'min' && size() < Number(arg)) messages.push(`The ${field} field must be at least ${arg}${unit}.`)
    if (name === 'between') {
      const [min, max] = arg.split(',').map(Number)
      const n = size()
      if (!(n >= min && n <= max)) messages.push(`The ${field} field must be between ${min} and ${max}${unit}.`)
    }
    if (name === 'confirmed' && value !== data[`${field}_confirmation`]) messages.push(`The ${field} field confirmation does not match.`)
  }
  return messages
}

/** The request's email as LoginRequest & co. prepared it: strtolower(trim((string) $email)) — ASCII-only, like PHP 8 */
export function normalizeEmail(value) {
  const text = value === null || value === undefined || typeof value === 'object' ? (value ? '[invalid]' : '') : value === true ? '1' : value === false ? '' : String(value)
  return text.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}

/** Laravel's TrimStrings + ConvertEmptyStringsToNull for one input (not used for passwords, which aren't trimmed) */
export function trimmed(value) {
  if (typeof value !== 'string') return value
  const text = value.trim()
  return text === '' ? null : text
}

/** ConvertEmptyStringsToNull alone (passwords keep their spaces) */
export const emptyToNull = (value) => (value === '' ? null : value)
