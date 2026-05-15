import { presentAuthUser } from '../utils/index.js'
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '../utils/tokens.js'
import * as auth from '../services/auth.service.js'

/**
 *   POST /auth/login             { email, password }                → { token, user } + Set-Cookie
 *   POST /auth/forgot-password   { email }                          → { message }        (throttle 5/min, shared)
 *   POST /auth/reset-password    { token, email, password, password_confirmation } → { message, token, user } + Set-Cookie
 *   GET  /auth/me                                                   → { data: user }
 *   POST /auth/logout            { reason? }                        → { message } + Clear-Cookie
 * Bodies arrive prepared and validated by middleware/validators/auth.validator.js.
 */

export async function login(req, res) {
  const result = await auth.login(req, req.body)
  res.cookie(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions())
  res.json(result)
}

export async function forgotPassword(req, res) {
  res.json({ message: await auth.forgotPassword(req, req.body.email) })
}

export async function resetPassword(req, res) {
  const result = await auth.resetPassword(req, req.body)
  res.cookie(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions())
  res.json({ message: 'Your password was reset.', ...result })
}

export async function me(req, res) {
  res.json({ data: presentAuthUser(await auth.currentUser(req.user.id)) })
}

export async function logout(req, res) {
  await auth.logout(req, req.body?.reason)
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...getAuthCookieOptions(),
    maxAge: undefined,
  })
  res.json({ message: 'Signed out.' })
}
