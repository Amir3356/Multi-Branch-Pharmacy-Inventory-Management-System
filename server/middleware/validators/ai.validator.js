import { DateTime, HttpError, config, validationError } from '../../utils/index.js'
import { cleanInput } from '../../utils/helpers.js'
import { validateInput } from '../../utils/validation.js'
import { PERIOD_RULES } from './report.validator.js'

// The longest period the Owner's advisor analyses in one go
const MAX_SCOPE_DAYS = 366

/**
 * The Owner's analysis scope: from, to (Y-m-d) and branchId ('all' or empty = every branch), from the query (GET) or
 * the body (POST), checked like the dashboard's period. req.aiScope is null — the default last 30 days at every
 * branch — when no period is sent.
 */
export async function validateAiScope(req, res, next) {
  req.aiScope = null
  const source = cleanInput((req.method === 'GET' ? req.query : req.body) ?? {})
  const input = { from: source.from, to: source.to, branchId: source.branchId === 'all' ? null : source.branchId }
  if ((input.from === undefined || input.from === null || input.from === '') && (input.to === undefined || input.to === null || input.to === '')) {
    req.aiScope = input.branchId ? { ...defaultPeriod(), branchId: input.branchId } : null
    if (req.aiScope) await validateInput(req.aiScope, PERIOD_RULES)
    return next()
  }
  const valid = await validateInput(input, PERIOD_RULES)
  const days = DateTime.fromISO(valid.to).diff(DateTime.fromISO(valid.from), 'days').days + 1
  if (days > MAX_SCOPE_DAYS) throw validationError({ to: ['Choose a period of one year or less for AI analysis.'] })
  req.aiScope = { from: valid.from, to: valid.to, branchId: valid.branchId ?? null }
  next()
}

// The last 30 days in the store's time zone
function defaultPeriod() {
  const today = DateTime.now().setZone(config.timezone).startOf('day')
  return { from: today.minus({ days: 29 }).toISODate(), to: today.toISODate() }
}

/**
 * POST /ai/chat: the conversation, validated with Laravel's rules and messages, and the last message must be the
 * user's question. The messages ([{ role, content }]) go to req.validatedBody.messages.
 */
export function validateChat(req, res, next) {
  const messages = validateMessages(cleanInput(req.body ?? {}))
  if (messages.at(-1)?.role !== 'user') throw new HttpError(422, 'The last message must be your question.')
  req.validatedBody = { messages }
  next()
}

// json_decode turned JSON objects and arrays alike into PHP arrays
const isPhpArray = (value) => value !== null && typeof value === 'object'
const entriesOf = (value) => (Array.isArray(value) ? value.map((item, i) => [String(i), item]) : Object.entries(value))
const isEmpty = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (isPhpArray(value) && entriesOf(value).length === 0)
// Laravel's size for a field without numeric rules: a count for arrays, otherwise the string length
const size = (value) => (isPhpArray(value) ? entriesOf(value).length : [...(value === true ? '1' : value === false ? '' : String(value))].length)

/**
 * Laravel's rules, messages and order for:
 *   messages: required|array|min:1|max:20, messages.*.role: required|string|in:user,assistant,
 *   messages.*.content: required|string|max:2000 ('Keep each message under 2000 characters.')
 * Returns [{ role, content }].
 */
function validateMessages(data) {
  const errors = {}
  const fail = (field, message) => (errors[field] ??= []).push(message)
  const list = data.messages

  if (isEmpty(list)) {
    fail('messages', 'The messages field is required.')
  } else {
    if (!isPhpArray(list)) fail('messages', 'The messages field must be an array.')
    if (size(list) < 1) fail('messages', 'The messages field must have at least 1 items.')
    if (size(list) > 20) fail('messages', 'The messages field must not have more than 20 items.')
  }

  // Wildcard rules apply to the items that are arrays themselves; a missing key counts as present and null
  const items = isPhpArray(list) ? entriesOf(list).filter(([, item]) => isPhpArray(item)) : []
  for (const [key, item] of items) {
    const field = `messages.${key}.role`
    const role = item.role ?? null
    if (isEmpty(role)) {
      fail(field, `The ${field} field is required.`)
      continue
    }
    if (typeof role !== 'string') fail(field, `The ${field} field must be a string.`)
    if (isPhpArray(role) || !['user', 'assistant'].includes(role === true ? '1' : role === false ? '' : String(role))) fail(field, `The selected ${field} is invalid.`)
  }
  for (const [key, item] of items) {
    const field = `messages.${key}.content`
    const content = item.content ?? null
    if (isEmpty(content)) {
      fail(field, `The ${field} field is required.`)
      continue
    }
    if (typeof content !== 'string') fail(field, `The ${field} field must be a string.`)
    if (size(content) > 2000) fail(field, 'Keep each message under 2000 characters.')
  }
  if (Object.keys(errors).length) throw validationError(errors)

  return entriesOf(list).map(([, m]) => {
    // PHP failed reading ['role'] from a plain string item (500); other scalars read as null
    if (typeof m === 'string') throw new Error('A chat message is a string, not an object.')
    return isPhpArray(m) ? { role: m.role, content: m.content } : { role: null, content: null }
  })
}
