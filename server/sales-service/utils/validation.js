import { validationError } from './index.js'

/**
 * Laravel's validator semantics, which the old FormRequests relied on and zod can't express directly: every rule of a
 * field runs (so one field can collect several messages), a failed `required` stops the field, non-required rules
 * skip missing / empty / nullable-null values, `max`/`min` measure numbers, arrays or string length depending on the
 * field's other rules, `batches.*.qty` expands per item, and custom messages match 'field.rule' / 'field.*' patterns.
 *
 * A field's rules are strings ('required', 'max:120', 'date_format:Y-m-d'), objects ({ name: 'in', values },
 * { name: 'exists', test: async (value) => bool }, { name: 'required', when: bool } for Rule::requiredIf), or closures
 * (value, fail) => … that call fail(message), like Laravel's closure rules.
 */

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
const PHP_NUMERIC = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/

/** PHP's is_numeric */
export const isNumeric = (value) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && PHP_NUMERIC.test(value))

// A PHP array: a JSON list or object
const isArrayLike = (value) => Array.isArray(value) || (value !== null && typeof value === 'object')
const countOf = (value) => (Array.isArray(value) ? value.length : Object.keys(value).length)
const keysOf = (value) => (Array.isArray(value) ? value.map((_, i) => String(i)) : Object.keys(value))

/** "branchId" → "branch id" (Laravel's displayable attribute: Str::snake, underscores as spaces) */
export const displayName = (attribute) => attribute.replace(/(.)(?=[A-Z])/g, '$1_').toLowerCase().replace(/_/g, ' ')

function lookup(data, path) {
  let target = data
  for (const segment of path.split('.')) {
    if (!isArrayLike(target) || !Object.hasOwn(target, segment)) return { present: false, value: undefined }
    target = target[segment]
  }
  return { present: true, value: target }
}

// 'batches.*.qty' → ['batches.0.qty', 'batches.1.qty'] for the items present; nothing when batches isn't an array
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
  // Rule::requiredIf(false) is no rule at all
  if (rule.name === 'required' && 'when' in rule) return rule.when ? { name: 'required', params: [] } : { name: null }
  return { params: [], ...rule }
}

// Y-m-d as PHP's DateTime::createFromFormat parses it (lenient: overflowing days roll over), else date_create's guess
function parseDate(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value)
  const match = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const guess = Date.parse(text)
  return Number.isNaN(guess) ? null : guess
}

function isExactDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = parseDate(value)
  return time !== null && new Date(time).toISOString().slice(0, 10) === value
}

function sizeOf(value, type) {
  if (type === 'numeric' && isNumeric(value)) return Number(value)
  if (isArrayLike(value)) return countOf(value)
  return [...String(value ?? '')].length
}

function passes(name, params, value, { type, siblings }) {
  switch (name) {
    case 'required':
      return !(value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (isArrayLike(value) && countOf(value) === 0))
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
      return sizeOf(value, type) >= Number(params[0])
    case 'max':
      return sizeOf(value, type) <= Number(params[0])
    case 'gt':
      return isNumeric(value) && Number(value) > Number(params[0])
    case 'date_format':
      return isExactDate(value)
    case 'before_or_equal':
    case 'after': {
      const first = parseDate(value)
      const second = parseDate(params[0])
      if (first === null || second === null) return false
      return name === 'after' ? first > second : first <= second
    }
    case 'distinct':
      return !siblings.some((other) => other === value)
    default:
      throw new Error(`Unknown validation rule ${name}`)
  }
}

function customMessage(messages, attribute, rule) {
  for (const key of [`${attribute}.${rule}`, rule, attribute]) {
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

/**
 * Runs the rules and returns { field: [messages] } (empty when valid), in rule order like Laravel's MessageBag.
 */
export async function collectErrors(data, rules, messages = {}) {
  const errors = {}
  const add = (attribute, message) => {
    errors[attribute] ??= []
    if (!errors[attribute].includes(message)) errors[attribute].push(message)
  }

  for (const [key, list] of Object.entries(rules)) {
    const parsed = list.map(parseRule)
    const names = parsed.map((rule) => rule.name)
    const type = names.includes('numeric') || names.includes('integer') ? 'numeric' : names.includes('array') ? 'array' : 'string'
    const nullable = names.includes('nullable')
    const attributes = expand(key, data)

    for (const attribute of attributes) {
      const { present, value } = lookup(data, attribute)
      for (const rule of parsed) {
        const { name, params } = rule
        if (name === null || name === 'nullable') continue
        const implicit = name === 'required'
        // Laravel skips non-implicit rules for missing, blank, or (when nullable) null values
        if (!implicit && (!present || (typeof value === 'string' && value.trim() === '') || (value === null && nullable))) continue

        if (name === 'closure') {
          await rule.closure(value, (message) => add(attribute, message))
          continue
        }
        let ok
        if (name === 'exists') ok = await rule.test(value)
        else if (name === 'in') ok = !isArrayLike(value) && rule.values.includes(value === true ? '1' : value === false || value == null ? '' : String(value))
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

/** collectErrors, throwing Laravel's 422 when anything failed */
export async function validateRules(data, rules, messages = {}) {
  const errors = await collectErrors(data, rules, messages)
  if (Object.keys(errors).length) throw validationError(errors)
  return data
}
