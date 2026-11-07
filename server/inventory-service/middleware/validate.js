import { validate } from '../utils/validate.js'

/**
 * Validates part of the request against a zod schema before the controller runs, replacing it with the parsed value
 * (Laravel's FormRequest). A failure is a Laravel-shaped 422.
 *   router.post('/sales', requireRole('cashier'), validateBody(storeSaleSchema), salesController.store)
 */
export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = validate(schema, req.body)
    next()
  } catch (error) {
    next(error)
  }
}

export const validateQuery = (schema) => (req, res, next) => {
  try {
    req.validatedQuery = validate(schema, req.query)
    next()
  } catch (error) {
    next(error)
  }
}
