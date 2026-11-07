import { validate } from '../../utils/index.js'
import { emptyToNull, laravelRules, normalizeEmail, trimmed } from '../../utils/laravelRules.js'

/**
 * The auth FormRequests (LoginRequest & co.): each prepares its input as Laravel did (trimmed, lower-cased email,
 * empty strings as null), validates it with Laravel's rules and messages, and replaces req.body with the prepared input.
 */

/** POST /auth/login → req.body = { email, password } */
export function validateLogin(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = emptyToNull(req.body?.password)
    validate(laravelRules({ email: ['required', 'email'], password: ['required', 'string'] }), { email, password })
    req.body = { email, password }
    next()
  } catch (error) {
    next(error)
  }
}

/** POST /auth/forgot-password → req.body = { email } */
export function validateForgotPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)
    validate(laravelRules({ email: ['required', 'email'] }), { email })
    req.body = { email }
    next()
  } catch (error) {
    next(error)
  }
}

/** POST /auth/reset-password → req.body = { token, email, password, password_confirmation } */
export function validateResetPassword(req, res, next) {
  try {
    const input = {
      token: trimmed(req.body?.token),
      email: normalizeEmail(req.body?.email),
      password: emptyToNull(req.body?.password),
      password_confirmation: emptyToNull(req.body?.password_confirmation),
    }
    validate(
      laravelRules({
        token: ['required', 'string'],
        email: ['required', 'email'],
        // Any password is accepted; it only has to match the confirmation
        password: ['required', 'string', 'max:255', 'confirmed'],
      }),
      input,
    )
    req.body = input
    next()
  } catch (error) {
    next(error)
  }
}
