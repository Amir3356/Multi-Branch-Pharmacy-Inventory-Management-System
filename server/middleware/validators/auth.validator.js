import { validate, z } from '../../utils/index.js'

function normalizeEmail(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

const loginSchema = z.object({
  email: z.string().min(1, 'The email field is required.').email('The email field must be a valid email address.'),
  password: z.string().min(1, 'The password field is required.'),
})

/** POST /auth/login → req.body = { email, password } */
export function validateLogin(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    validate(loginSchema, { email, password })
    req.body = { email, password }
    next()
  } catch (error) {
    next(error)
  }
}

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'The email field is required.').email('The email field must be a valid email address.'),
})

/** POST /auth/forgot-password → req.body = { email } */
export function validateForgotPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)
    validate(forgotPasswordSchema, { email })
    req.body = { email }
    next()
  } catch (error) {
    next(error)
  }
}

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'The token field is required.'),
    email: z.string().min(1, 'The email field is required.').email('The email field must be a valid email address.'),
    password: z.string().min(1, 'The password field is required.').max(255),
    password_confirmation: z.string().min(1, 'The password confirmation field is required.'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'The password field confirmation does not match.',
    path: ['password_confirmation'],
  })

/** POST /auth/reset-password → req.body = { token, email, password, password_confirmation } */
export function validateResetPassword(req, res, next) {
  try {
    const input = {
      token: typeof req.body?.token === 'string' ? req.body.token.trim() : '',
      email: normalizeEmail(req.body?.email),
      password: typeof req.body?.password === 'string' ? req.body.password : '',
      password_confirmation: typeof req.body?.password_confirmation === 'string' ? req.body.password_confirmation : '',
    }
    validate(resetPasswordSchema, input)
    req.body = input
    next()
  } catch (error) {
    next(error)
  }
}
