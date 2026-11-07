import { presentAuthUser } from '../utils/index.js'
import * as auth from '../services/auth.service.js'

/**
 *   POST /auth/login             { email, password }                → { token, user }
 *   POST /auth/forgot-password   { email }                          → { message }        (throttle 5/min, shared)
 *   POST /auth/reset-password    { token, email, password, password_confirmation } → { message, token, user }
 *   GET  /auth/me                                                   → { data: user }
 *   POST /auth/logout            { reason? }                        → { message }
 * Bodies arrive prepared and validated by middleware/validators/auth.validator.js.
 */

export async function login(req, res) {
  res.json(await auth.login(req, req.body))
}

export async function forgotPassword(req, res) {
  res.json({ message: await auth.forgotPassword(req, req.body.email) })
}

export async function resetPassword(req, res) {
  res.json({ message: 'Your password was reset.', ...(await auth.resetPassword(req, req.body)) })
}

export async function me(req, res) {
  res.json({ data: presentAuthUser(await auth.currentUser(req.user.id)) })
}

export async function logout(req, res) {
  await auth.logout(req, req.body?.reason)
  res.json({ message: 'Signed out.' })
}
