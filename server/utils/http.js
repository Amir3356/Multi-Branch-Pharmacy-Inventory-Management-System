import { HttpError } from '../utils/index.js'

/**
 * Laravel's route-model binding miss: 404 "No query results for model [App\…\User] 7". Laravel sent this for an id
 * with no row (a non-numeric id made PostgreSQL fail with a 500 there; here it gets the same 404).
 */
export const modelNotFound = (model, id) => new HttpError(404, `No query results for model [${model}] ${id}`)

export const MODELS = Object.freeze({
  user: 'App\\Features\\Accounts\\Models\\User',
  accessReview: 'App\\Features\\AccessReviews\\Models\\AccessReview',
})

/** A bigint route id, or null when it can't be one */
export const numericId = (value) => (/^\d{1,18}$/.test(String(value)) ? Number(value) : null)

/** Capitalize first letter */
export const capitalize = (value) => {
  const text = String(value ?? '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const ucfirst = capitalize
