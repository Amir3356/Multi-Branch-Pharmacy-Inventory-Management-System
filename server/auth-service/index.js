import { config, createService, schedule } from './utils/index.js'
import { registerRoutes } from './routes/index.js'
import { expireInactiveSessions, pruneOldSessions } from './services/session.service.js'

/**
 * auth-service: sign-in, password reset, and sessions (one Sanctum-compatible bearer token per signed-in browser).
 * Public routes in routes/auth.routes.js and routes/session.routes.js; service-to-service ones in routes/internal.routes.js.
 */
createService({
  name: 'auth-service',
  key: 'auth',
  routes: registerRoutes,
  onStart: () => {
    // Signs out sessions left open past SESSION_TIMEOUT_MINUTES (e.g. a browser closed without signing out), so
    // Session Monitoring is right even when nobody has the page open
    schedule('*/5 * * * *', 'expire-inactive-sessions', () => expireInactiveSessions())

    // Housekeeping: rows older than 30 days can't sign in (tokens expire after 7) and are never shown
    schedule('0 2 * * *', 'prune-old-sessions', () => pruneOldSessions(), { timezone: config.timezone })
  },
})
