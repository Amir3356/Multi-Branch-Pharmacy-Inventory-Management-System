import { HttpError, unauthenticated } from '../utils/errors.js'
import { ACCOUNT_STATUSES } from '../utils/roles.js'

/** Signed-in users only (Laravel's auth:sanctum) */
export function requireAuth(req, res, next) {
  return req.user ? next() : next(unauthenticated())
}

/**
 * Active users with one of the given roles (Laravel's role:owner,cashier). Put it before any record lookup, so a role
 * without access gets 403 for every id and can't learn which ids exist.
 */
export function requireRole(...roles) {
  return [
    requireAuth,
    (req, res, next) => {
      if (req.user.status !== ACCOUNT_STATUSES.ACTIVE) return next(new HttpError(403, 'Your account is not active.'))
      if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Your role does not have access to this section.'))
      next()
    },
  ]
}
