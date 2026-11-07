import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

// Settings come from real environment variables first, then this service's own .env (copy .env.example to start)
const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(serviceRoot, '.env'), quiet: true })

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
  serviceRoot,
  appName: env('APP_NAME', 'SuperMart IMS'),
  env: env('NODE_ENV', 'development'),
  appUrl: env('APP_URL', 'http://localhost:8000').replace(/\/$/, ''),
  frontendUrl: env('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, ''),
  internalSecret: env('INTERNAL_SERVICE_SECRET', 'dev-internal-secret'),
  trustedProxies: env('TRUSTED_PROXIES', ''),

  gatewayPort: int('GATEWAY_PORT', 8000),
  services: {
    auth: env('AUTH_SERVICE_URL', 'http://localhost:4001'),
    user: env('USER_SERVICE_URL', 'http://localhost:4002'),
    branch: env('BRANCH_SERVICE_URL', 'http://localhost:4003'),
    inventory: env('INVENTORY_SERVICE_URL', 'http://localhost:4004'),
    sales: env('SALES_SERVICE_URL', 'http://localhost:4005'),
    procurement: env('PROCUREMENT_SERVICE_URL', 'http://localhost:4006'),
    reporting: env('REPORTING_SERVICE_URL', 'http://localhost:4007'),
    ai: env('AI_SERVICE_URL', 'http://localhost:4008'),
    notification: env('NOTIFICATION_SERVICE_URL', 'http://localhost:4009'),
  },

  db: {
    host: env('DB_HOST', 'localhost'),
    port: int('DB_PORT', 5432),
    database: env('DB_DATABASE', 'multi_branch_supermarket'),
    user: env('DB_USERNAME', 'postgres'),
    password: env('DB_PASSWORD', ''),
    poolSize: int('DB_POOL_SIZE', 10),
  },

  mail: {
    mailer: env('MAIL_MAILER', 'smtp'),
    host: env('MAIL_HOST', 'localhost'),
    port: int('MAIL_PORT', 587),
    username: env('MAIL_USERNAME'),
    password: env('MAIL_PASSWORD'),
    fromAddress: env('MAIL_FROM_ADDRESS', 'no-reply@example.com'),
    fromName: env('MAIL_FROM_NAME', 'SuperMart IMS'),
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

  chapa: {
    mode: env('CHAPA_MODE', 'test'),
    publicKey: env('CHAPA_PUBLIC_KEY'),
    secretKey: env('CHAPA_SECRET_KEY'),
    baseUrl: env('CHAPA_BASE_URL', 'https://api.chapa.co/v1').replace(/\/$/, ''),
  },

  openrouter: {
    apiKey: env('OPENROUTER_API_KEY'),
    baseUrl: env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    model: env('OPENROUTER_MODEL', 'apodex/apodex-1.1-mini:free'),
    timeout: int('OPENROUTER_TIMEOUT', 60),
    reasoning: bool('OPENROUTER_REASONING', true),
  },
})

/** The port a service listens on: PORT, else the port in its own *_SERVICE_URL */
export function servicePort(serviceKey) {
  if (process.env.PORT) return Number(process.env.PORT)
  return Number(new URL(config.services[serviceKey]).port)
}
