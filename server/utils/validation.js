import { one, validationError } from './index.js'
import { isNumeric } from './helpers.js'

/**
 * Laravel's validator for query strings and form requests.
 */

export const NULLABLE = Symbol('nullable')

// Laravel shows camelCase fields in messages through Str::snake: branchId → "branch id"
const label = (field) => field.replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase().replace(/_/g, ' ')
export const displayName = (attribute) => attribute.replace(/(.)(?=[A-Z])/g, '$1_').toLowerCase().replace(/_/g, ' ')

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

const size = (value, numeric) => (numeric && isNumeric(value) ? Number(value) : Array.isArray(value) ? value.length : [...String(value ?? '')].length)

export const max = (field, limit) => ({ test: (value) => size(value, false) <= limit, message: `The ${label(field)} field must not be greater than ${limit} characters.` })

export const integer = (field) => ({
  test: (value) => (typeof value === 'number' ? Number.isInteger(value) : typeof value === 'string' && /^[ \t\n\r\v\f]*[+-]?(0|[1-9]\d*)[ \t\n\r\v\f]*$/.test(value)),
  message: `The ${label(field)} field must be an integer.`,
})

export const minNumber = (field, limit) => ({ test: (value) => size(value, true) >= limit, message: `The ${label(field)} field must be at least ${limit}.` })

export const inList = (field, list) => ({
  test: (value) => !Array.isArray(value) && value !== null && typeof value !== 'object' && list.includes(String(value)),
  message: `The selected ${label(field)} is invalid.`,
})

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
        if (rule.implicit) break
      }
    }
    if (present) validated[field] = value
  }
  if (Object.keys(errors).length) throw validationError(errors)
  return validated
}

// Sales-service / general FormRequest validator
const DEFAULT_MESSAGES = {
  required: 'The :attribute field is required.',
  string: 'The :attribute field must be a string.',
  integer: 'The :attribute field must be an integer.',
  numeric: 'The :attribute field must be a number.',
  array: 'The :attribute field must be an array.',
  uuid: 'The :attribute field must be a valid UUID.',
  in: 'The selected :attribute is invalid.',
  exists: 'The selected :attribute is invalid.',
  distinct: 'The :attribute field has a duplicate value.',
  date_format: 'The :attribute field must match the format :format.',
  after: 'The :attribute field must be a date after :date.',
  before_or_equal: 'The :attribute field must be a date before or equal to :date.',
  gt: {
    numeric: 'The :attribute field must be greater than :value.',
    string: 'The :attribute field must be greater than :value characters.',
    array: 'The :attribute field must have more than :value items.',
  },
  min: {
    numeric: 'The :attribute field must be at least :min.',
    string: 'The :attribute field must be at least :min characters.',
    array: 'The :attribute field must have at least :min items.',
  },
  max: {
    numeric: 'The :attribute field must not be greater than :max.',
    string: 'The :attribute field must not be greater than :max characters.',
    array: 'The :attribute field must not have more than :max items.',
  },
}

const UUID = /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/
const isArrayLike = (value) => Array.isArray(value) || (value !== null && typeof value === 'object')
const keysOf = (value) => (Array.isArray(value) ? value.map((_, i) => String(i)) : Object.keys(value))

function lookup(data, path) {
  let target = data
  for (const segment of path.split('.')) {
    if (!isArrayLike(target) || !Object.hasOwn(target, segment)) return { present: false, value: undefined }
    target = target[segment]
  }
  return { present: true, value: target }
}

function expand(key, data) {
  const star = key.indexOf('*')
  if (star === -1) return [key]
  const parentPath = key.slice(0, star - 1)
  const rest = key.slice(star + 1)
  const { value: parent } = lookup(data, parentPath)
  if (!isArrayLike(parent)) return []
  return keysOf(parent).flatMap((k) => expand(`${parentPath}.${k}${rest}`, data))
}

function parseRule(rule) {
  if (typeof rule === 'function') return { name: 'closure', closure: rule }
  if (typeof rule === 'string') {
    const [name, params = ''] = rule.split(/:(.*)/s)
    return { name, params: params === '' ? [] : params.split(',') }
  }
  if (rule.name === 'required' && 'when' in rule) return rule.when ? { name: 'required', params: [] } : { name: null }
  return { params: [], ...rule }
}

function isExactDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = parseLenient(value)
  return time !== null && new Date(time).toISOString().slice(0, 10) === value
}

function passes(name, params, value, { type, siblings }) {
  switch (name) {
    case 'required':
      return !isEmpty(value)
    case 'string':
      return typeof value === 'string'
    case 'integer':
      if (typeof value === 'number') return Number.isInteger(value)
      if (typeof value === 'boolean') return value
      return typeof value === 'string' && /^[+-]?(0|[1-9]\d*)$/.test(value.trim())
    case 'numeric':
      return isNumeric(value)
    case 'array':
      return isArrayLike(value)
    case 'uuid':
      return typeof value === 'string' && UUID.test(value)
    case 'min':
      return size(value, type === 'numeric') >= Number(params[0])
    case 'max':
      return size(value, type === 'numeric') <= Number(params[0])
    case 'gt':
      return isNumeric(value) && Number(value) > Number(params[0])
    case 'date_format':
      return isExactDate(value)
    case 'before_or_equal':
    case 'after': {
      const first = parseLenient(value)
      const second = parseLenient(params[0])
      if (first === null || second === null) return false
      return name === 'after' ? first > second : first <= second
    }
    case 'distinct':
      return !siblings.some((other) => other === value)
    default:
      throw new Error(`Unknown validation rule ${name}`)
  }
}

function customMessage(messages, attribute, ruleName) {
  for (const key of [`${attribute}.${ruleName}`, ruleName, attribute]) {
    for (const [pattern, message] of Object.entries(messages)) {
      const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]*')}$`)
      if (regex.test(key)) return message
    }
  }
  return null
}

function messageFor(messages, attribute, name, params, type) {
  let template = customMessage(messages, attribute, name) ?? DEFAULT_MESSAGES[name]
  if (typeof template === 'object') template = template[type]
  const param = params[0] ?? ''
  return template
    .replaceAll(':attribute', displayName(attribute))
    .replace(/:(max|min|value|format|date)\b/g, param)
}

export async function collectErrors(data, rules, messages = {}) {
  const errors = {}
  const add = (attribute, message) => {
    errors[attribute] ??= []
    if (!errors[attribute].includes(message)) errors[attribute].push(message)
  }

  for (const [key, list] of Object.entries(rules)) {
    const parsed = list.map(parseRule)
    const names = parsed.map((ruleItem) => ruleItem.name)
    const type = names.includes('numeric') || names.includes('integer') ? 'numeric' : names.includes('array') ? 'array' : 'string'
    const nullable = names.includes('nullable')
    const attributes = expand(key, data)

    for (const attribute of attributes) {
      const { present, value } = lookup(data, attribute)
      for (const ruleItem of parsed) {
        const { name, params } = ruleItem
        if (name === null || name === 'nullable') continue
        const implicit = name === 'required'
        if (!implicit && (!present || (typeof value === 'string' && value.trim() === '') || (value === null && nullable))) continue

        if (name === 'closure') {
          await ruleItem.closure(value, (message) => add(attribute, message))
          continue
        }
        let ok
        if (name === 'exists') ok = await ruleItem.test(value)
        else if (name === 'in') ok = !isArrayLike(value) && ruleItem.values.includes(value === true ? '1' : value === false || value == null ? '' : String(value))
        else {
          const siblings = name === 'distinct' ? attributes.filter((other) => other !== attribute).map((other) => lookup(data, other).value) : []
          ok = passes(name, params, value, { type, siblings })
        }
        if (!ok) {
          add(attribute, messageFor(messages, attribute, name, params, type))
          if (implicit) break
        }
      }
    }
  }
  return errors
}

export async function validateRules(data, rules, messages = {}) {
  const errors = await collectErrors(data, rules, messages)
  if (Object.keys(errors).length) throw validationError(errors)
  return data
}
