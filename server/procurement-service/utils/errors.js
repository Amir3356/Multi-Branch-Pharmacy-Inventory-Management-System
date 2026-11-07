/**
 * Errors become JSON responses in the shape the React client already reads (the one Laravel sent):
 *   { "message": "..." }                                   any error
 *   { "message": "...", "errors": { "field": ["..."] } }  validation (422)
 */
export class HttpError extends Error {
  constructor(status, message, errors = undefined, extra = undefined) {
    super(message)
    this.status = status
    this.errors = errors
    // Extra top-level fields for the response body
    this.extra = extra
  }

  toJSON() {
    return { message: this.message, ...(this.errors ? { errors: this.errors } : {}), ...(this.extra || {}) }
  }
}

/** Throws an HttpError (Laravel's abort()) */
export function abort(status, message) {
  throw new HttpError(status, message)
}

/** Laravel's summary line: the first message, plus "(and 2 more errors)" when there are others */
export function validationMessage(errors) {
  const messages = Object.values(errors).flat()
  const more = messages.length - 1
  if (!messages.length) return 'The given data was invalid.'
  return more > 0 ? `${messages[0]} (and ${more} more error${more === 1 ? '' : 's'})` : messages[0]
}

/** A 422 with per-field messages: validationError({ email: 'Invalid email or password.' }) */
export function validationError(errors) {
  const normalized = Object.fromEntries(Object.entries(errors).map(([field, value]) => [field, Array.isArray(value) ? value : [value]]))
  return new HttpError(422, validationMessage(normalized), normalized)
}

export function notFound(message = 'The requested record was not found.') {
  return new HttpError(404, message)
}

export function unauthenticated() {
  return new HttpError(401, 'Unauthenticated.')
}
