import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Generate random alphanumeric string */
export function randomString(length = 32) {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHANUMERIC[crypto.randomInt(ALPHANUMERIC.length)]
  return out
}

/** SHA-256 hash helper */
export const sha256 = (text) => crypto.createHash('sha256').update(String(text)).digest('hex')

/**
 * Sign a payload into a JWT
 */
export function signToken(payload, options = {}) {
  const expiresIn = options.expiresIn ?? config.jwt.expiresIn
  return jwt.sign(payload, config.jwt.secret, { ...options, expiresIn })
}

/**
 * Verify a JWT string. Throws if invalid or expired.
 */
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret)
}

/**
 * Generate a JWT token for an authenticated user
 */
export function generateToken(user, extra = {}) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branch_id ?? user.branchId ?? null,
    ...extra,
  }
  return signToken(payload)
}

export const AUTH_COOKIE_NAME = 'token'

/**
 * Standard cookie configuration for storing JWT securely in browsers:
 * - httpOnly: prevents client-side JS from reading cookie, neutralizing XSS token theft
 * - secure: ensures cookie is only transmitted over HTTPS in production
 * - sameSite: prevents CSRF attack vectors
 */
export function getAuthCookieOptions() {
  const isProd = config.env === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  }
}
