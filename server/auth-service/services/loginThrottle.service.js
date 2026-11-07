import { validationError } from '../utils/index.js'

/**
 * LoginRequest's rate limiting: after 5 failed sign-ins for the same email and IP, more attempts are refused until
 * 60 seconds after the first failure (Laravel's RateLimiter: hit(key, 60) starts the window on the first hit).
 * Kept in this service's memory, like the throttle middleware.
 */
const MAX_ATTEMPTS = 5
const DECAY_SECONDS = 60

const attempts = new Map()
const nowSeconds = () => Math.floor(Date.now() / 1000)

// Str::transliterate: accents and other non-ASCII letters fold to ASCII, so "é" and "e" share a counter
const transliterate = (text) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '')

export const throttleKey = (email, ip) => transliterate(`${email}|${ip ?? ''}`)

function current(key) {
  const entry = attempts.get(key)
  if (entry && entry.availableAt > nowSeconds()) return entry
  attempts.delete(key)
  return null
}

export function ensureIsNotRateLimited(key) {
  const entry = current(key)
  if (!entry || entry.count < MAX_ATTEMPTS) return

  const seconds = Math.max(0, entry.availableAt - nowSeconds())
  throw validationError({ email: `Too many sign-in attempts. Try again in ${seconds} seconds.` })
}

export function recordFailure(key) {
  const entry = current(key) ?? { count: 0, availableAt: nowSeconds() + DECAY_SECONDS }
  entry.count++
  attempts.set(key, entry)
}

export function clearFailures(key) {
  attempts.delete(key)
}

// Forget windows that have passed, so the map doesn't grow with every address that ever failed
setInterval(() => {
  const now = nowSeconds()
  for (const [key, entry] of attempts) if (entry.availableAt <= now) attempts.delete(key)
}, 5 * 60_000).unref()
