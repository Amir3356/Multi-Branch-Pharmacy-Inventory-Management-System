import { z } from 'zod'
import { validationError } from './errors.js'

export { z }

/**
 * Validates data against a zod schema and returns the parsed value, or throws a Laravel-shaped 422:
 *   { message: 'The email field is required. (and 1 more error)', errors: { email: [...], password: [...] } }
 * Give every rule a Laravel-style message (zod 4), e.g. z.string({ error: 'The email field is required.' }).
 */
export function validate(schema, data) {
  const result = schema.safeParse(data ?? {})
  if (result.success) return result.data

  const errors = {}
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'input'
    ;(errors[field] ??= [])
    if (!errors[field].includes(issue.message)) errors[field].push(issue.message)
  }
  throw validationError(errors)
}

/** Treats '' and null like a missing value, as Laravel's ConvertEmptyStringsToNull middleware does */
export const emptyToUndefined = (schema) => z.preprocess((value) => (value === '' || value === null ? undefined : value), schema)
