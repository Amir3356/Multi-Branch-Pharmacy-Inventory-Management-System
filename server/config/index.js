import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

// Settings come from real environment variables first, then server's own .env
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true })

const env = (key, fallback = undefined) => (process.env[key] === undefined || process.env[key] === '' ? fallback : process.env[key])
const int = (key, fallback) => {
  const value = Number.parseInt(env(key, ''), 10)
  return Number.isNaN(value) ? fallback : value
}
const bool = (key, fallback) => {
  const value = env(key)
  return value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

const sessionIdleMinutes = Math.max(5, int('SESSION_IDLE_MINUTES', 15))
const timeout = int('SESSION_TIMEOUT_MINUTES', 30)

export const config = Object.freeze({
  serverRoot,
  appName: env('APP_NAME', 'Multi-Branch Pharmacy Inventory'),
  env: env('NODE_ENV', 'development'),
  port: int('PORT', int('GATEWAY_PORT', 7000)),
  appUrl: env('APP_URL', 'http://localhost:7000').replace(/\/$/, ''),
  apiUrl: env('API_URL', 'http://localhost:7000/api').replace(/\/$/, ''),
  frontendUrl: env('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, ''),
  trustedProxies: env('TRUSTED_PROXIES', 'loopback'),

  db: {
    host: env('DB_HOST'),
    port: int('DB_PORT'),
    database: env('DB_DATABASE'),
    user: env('DB_USERNAME'),
    password: env('DB_PASSWORD'),
  },

  mail: {
    mailer: env('MAIL_MAILER', 'smtp'),
    host: env('MAIL_HOST', 'smtp.gmail.com'),
    port: int('MAIL_PORT', 587),
    username: env('MAIL_USERNAME', 'amirsiraj1995@gmail.com'),
    password: env('MAIL_PASSWORD', 'acpabuliwxhlmjnh'),
    fromAddress: env('MAIL_FROM_ADDRESS', 'amirsiraj1995@gmail.com'),
    fromName: env('MAIL_FROM_NAME', 'Multi-Branch Pharmacy Inventory'),
  },

  jwt: {
    secret: env('JWT_SECRET', 'dev-only-insecure-jwt-secret-set-JWT_SECRET-in-env'),
    expiresIn: env('JWT_EXPIRES_IN', '7d'),
  },

  invitationExpireMinutes: int('INVITATION_EXPIRE_MINUTES', 10),
  passwordResetExpireMinutes: int('PASSWORD_RESET_EXPIRE_MINUTES', 60),
  // Sanctum's expiration: a token stops working this long after it was created
  tokenExpirationMinutes: int('TOKEN_EXPIRATION_MINUTES', 60 * 24 * 7),
  sessionIdleMinutes,
  // Never shorter than the idle time, so a session always shows as Idle before it is signed out; 0 = never
  sessionTimeoutMinutes: timeout > 0 ? Math.max(sessionIdleMinutes, timeout) : 0,
  ipLocationLookup: bool('IP_LOCATION_LOOKUP', true),
  deviceLocation: bool('DEVICE_LOCATION', true),
  accessReviewDormantDays: int('ACCESS_REVIEW_DORMANT_DAYS', 90),
  accessReviewSchedule: env('ACCESS_REVIEW_SCHEDULE', ''),
  timezone: env('STORE_TIMEZONE', 'Africa/Addis_Ababa'),

  gemini: {
    apiKey: env('GEMINI_API_KEY', ''),
    baseUrl: env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
    model: env('GEMINI_MODEL', 'gemini-3.5-flash'),
    // Answers when the main model is still overloaded after retries ('none' turns it off)
    fallbackModel: env('GEMINI_FALLBACK_MODEL', 'gemini-3.5-flash-lite') === 'none' ? '' : env('GEMINI_FALLBACK_MODEL', 'gemini-3.5-flash-lite'),
    // Generous: Pro models think before answering and are much slower than Flash
    timeout: int('GEMINI_TIMEOUT', 90),
    // Optional: MINIMAL | LOW | MEDIUM | HIGH (empty = the model's default). Lower is faster, less careful.
    thinkingLevel: env('GEMINI_THINKING_LEVEL', '').toUpperCase(),
  },
})

export { pool, query, one, transaction, isUniqueViolation, runExclusive } from './db.js'
export { logger, setServiceName } from './logger.js'

export default config

