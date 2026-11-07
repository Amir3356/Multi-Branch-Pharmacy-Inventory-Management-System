import crypto from 'node:crypto'
import { crc32b } from './crc32.js'

/**
 * Bearer tokens compatible with the Sanctum 4 tokens already in personal_access_tokens:
 *   plaintext  "{id}|{secret}", secret = 40 random alphanumerics + crc32b (hex) of them (token_prefix is empty)
 *   stored     sha256 hex of the secret (the part after the "|")
 * The tokenable type stored with each token is TOKENABLE_TYPE in models/session.model.js.
 */
const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Laravel's Str::random(length) */
export function randomString(length) {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHANUMERIC[crypto.randomInt(ALPHANUMERIC.length)]
  return out
}

export const sha256 = (text) => crypto.createHash('sha256').update(String(text)).digest('hex')

/** Sanctum's generateTokenString() */
export function generateSecret() {
  const entropy = randomString(40)
  return `${entropy}${crc32b(entropy)}`
}

/** PHP's hash_equals for two hex digests */
export function hashEquals(known, given) {
  const a = Buffer.from(String(known ?? ''))
  const b = Buffer.from(String(given ?? ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * Splits a bearer token the way Sanctum's guard and findToken() read it:
 *   "{id}|{secret}" → { id, secret }   (the id must be digits and the secret non-empty, else invalid)
 *   "{secret}"      → { id: null, secret } (looked up by its hash)
 * Returns null for a token Sanctum would refuse outright.
 */
export function parseToken(token) {
  if (typeof token !== 'string' || token === '') return null
  const bar = token.indexOf('|')
  if (bar === -1) return { id: null, secret: token }
  const id = token.slice(0, bar)
  const secret = token.slice(bar + 1)
  if (!/^\d+$/.test(id) || secret === '') return null
  return { id: Number(id), secret }
}
