import { normalizeInput, rule, validateRules } from '../../utils/rules.js'
import { MAX_EXPIRY_WARNING_DAYS } from '../../models/policy.model.js'

/** Laravel's integer rule (FILTER_VALIDATE_INT): whole numbers, as numbers or numeric strings without leading zeros */
const toInteger = (value) => {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null
  if (typeof value === 'string' && /^\s*[+-]?(0|[1-9]\d{0,17})\s*$/.test(value)) return Number.parseInt(value, 10)
  return null
}

/** required|integer|min|max, all sharing one message (the form request's 'field.*' message) */
const wholeNumber = (min, max, message) => [
  rule.required(message),
  rule.check((value) => toInteger(value) !== null, message),
  rule.check((value) => toInteger(value) === null || toInteger(value) >= min, message),
  rule.check((value) => toInteger(value) === null || toInteger(value) <= max, message),
]

/** PUT /policy (UpdatePolicyRequest): req.body becomes { defaultMinStock, expiryWarningDays } as integers */
export function validateUpdatePolicy(req, res, next) {
  const input = validateRules(
    {
      defaultMinStock: { rules: wholeNumber(0, 1_000_000, 'Enter a whole number of 0 or more') },
      expiryWarningDays: { rules: wholeNumber(1, MAX_EXPIRY_WARNING_DAYS, `Enter a whole number from 1 to ${MAX_EXPIRY_WARNING_DAYS}`) },
    },
    normalizeInput(req.body),
  )
  req.body = { defaultMinStock: toInteger(input.defaultMinStock), expiryWarningDays: toInteger(input.expiryWarningDays) }
  next()
}
