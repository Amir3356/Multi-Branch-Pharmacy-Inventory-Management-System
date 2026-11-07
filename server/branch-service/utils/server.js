import express from 'express'
import { servicePort } from './config.js'
import { internalOnly } from '../middleware/internalOnly.js'
import { HttpError } from './errors.js'
import { pool } from './db.js'
import { logger, setServiceName } from './logger.js'

/**
 * Builds and starts this microservice with the conventions every service shares:
 *   - JSON bodies; every route behind internalOnly (only the gateway and other services may call it)
 *   - req.user / req.tokenId / req.clientIp / req.userAgent from the gateway (see context.js)
 *   - GET /health for the gateway and orchestration
 *   - errors as Laravel-shaped JSON ({ message, errors? }), unknown routes as 404
 *
 *   createService({ name: 'sales-service', key: 'sales', routes: (app) => app.use(salesRouter) })
 *
 * Public routes are mounted at the path the client uses minus the /api prefix (the gateway strips it):
 * the client's POST /api/sales arrives here as POST /sales. Service-to-service routes live under /internal/….
 */
export function createService({ name, key, routes, onStart, bodyLimit = '1mb' }) {
  setServiceName(name)
  const app = express()
  app.disable('x-powered-by')

  app.get('/health', async (req, res) => {
    try {
      await pool.query('select 1')
      res.json({ service: name, status: 'ok' })
    } catch (error) {
      res.status(503).json({ service: name, status: 'database unavailable', error: error.message })
    }
  })

  app.use(express.json({ limit: bodyLimit }))
  app.use(express.urlencoded({ extended: false }))
  app.use(internalOnly)

  routes(app)

  app.use((req, res) => res.status(404).json({ message: `The route ${req.path} could not be found.` }))

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error instanceof HttpError) return res.status(error.status).json(error.toJSON())
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ message: 'The request body is not valid JSON.' })
    // Every pooled connection stayed busy for DB_CONNECTION_TIMEOUT_MS: overloaded, so ask the client to retry
    if (/timeout exceeded when trying to connect/i.test(error?.message ?? '')) {
      logger.warn(`${req.method} ${req.originalUrl}: no free database connection`, { poolSize: pool.options.max })
      return res.status(503).json({ message: 'The server is busy right now. Try again in a moment.' })
    }
    if (error?.code === '23514' && error.constraint === 'stock_batches_units_not_negative') {
      return res.status(422).json({ message: 'Not enough stock left for this change. Reload the page to see the latest stock.' })
    }
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error?.message, stack: error?.stack?.split('\n').slice(0, 5).join(' | ') })
    res.status(500).json({ message: 'Server Error' })
  })

  const port = servicePort(key)
  const server = app.listen(port, () => {
    logger.info(`${name} listening on http://localhost:${port}`)
    onStart?.()
  })

  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)))
    setTimeout(() => process.exit(0), 5_000).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  return { app, server }
}

/** Express 5 passes rejected promises to the error handler, so handlers can simply be async. */
export const Router = express.Router
