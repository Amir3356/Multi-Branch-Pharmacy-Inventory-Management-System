import { rateLimit } from 'express-rate-limit'

/**
 * Laravel's throttle:max,minutes middleware, per visitor IP (as forwarded by the gateway) and, when signed in, per user.
 *   router.post('/forgot-password', throttle(5, 1, 'password-reset'), handler)
 * Counts live in this service's memory; run one instance per service, or put a shared store here when scaling out.
 */
export function throttle(max, minutes = 1, name = 'default') {
  return rateLimit({
    windowMs: minutes * 60_000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `${name}:${req.user?.id ?? req.clientIp ?? req.ip}`,
    handler: (req, res) => res.status(429).json({ message: 'Too Many Attempts.' }),
    validate: false,
  })
}
