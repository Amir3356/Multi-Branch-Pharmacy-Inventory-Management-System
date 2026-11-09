import http from 'node:http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'

dotenv.config()
import { config, logger, pool, setServiceName } from './config/index.js'
import { schedule } from './utils/index.js'
import { HttpError } from './utils/errors.js'
import { authenticate } from './middleware/authenticate.js'
import { apiRouter } from './routes/index.js'
import { attachRealtime } from './services/realtime.service.js'
import { expireInactiveSessions, pruneOldSessions } from './services/session.service.js'

setServiceName('supermart-server')

const app = express()
app.disable('x-powered-by')

// Security headers with Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }),
)

// Which proxies may tell us the visitor's real IP (X-Forwarded-For). Accepts "true", a hop count ("1"),
// or a comma-separated list of addresses/subnets/presets ("loopback, 10.0.0.0/8").
{
  const trust = String(config.trustedProxies ?? '').trim()
  if (/^true$/i.test(trust)) app.set('trust proxy', true)
  else if (/^\d+$/.test(trust)) app.set('trust proxy', Number(trust))
  else if (trust && !/^false$/i.test(trust)) app.set('trust proxy', trust.split(',').map((t) => t.trim()).filter(Boolean))
}

// CORS for the React single page app
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With', 'Idempotency-Key', 'idempotency-key'],
    exposedHeaders: ['Idempotent-Replayed'],
  }),
)

app.use(cookieParser())
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ extended: false, limit: '20mb' }))

// Health checks
const healthHandler = async (req, res) => {
  try {
    await pool.query('select 1')
    res.json({ service: 'supermart-server', status: 'ok', architecture: 'monolithic' })
  } catch (error) {
    res.status(503).json({ service: 'supermart-server', status: 'database unavailable', error: error.message })
  }
}
app.get('/health', healthHandler)
app.get('/api/health', healthHandler)

// Global authentication context
app.use(authenticate)

// API routes mounted at /api and /
app.use('/api', apiRouter)
app.use(apiRouter)

// 404 handler for unknown routes
app.use((req, res) => res.status(404).json({ message: `The route ${req.path} could not be found.` }))

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error instanceof HttpError) return res.status(error.status).json(error.toJSON())
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ message: 'The request body is not valid JSON.' })

  // Database connection timeout
  if (/timeout exceeded when trying to connect/i.test(error?.message ?? '')) {
    logger.warn(`${req.method} ${req.originalUrl}: database connection timeout`)
    return res.status(503).json({ message: 'The server is busy right now. Try again in a moment.' })
  }

  // Stock batch constraint
  if (error?.code === '23514' && error.constraint === 'stock_batches_units_not_negative') {
    return res.status(422).json({ message: 'Not enough stock left for this change. Reload the page to see the latest stock.' })
  }

  logger.error(`${req.method} ${req.originalUrl} failed`, {
    error: error?.message,
    stack: error?.stack?.split('\n').slice(0, 5).join(' | '),
  })
  res.status(500).json({ message: 'Server Error' })
})

// Create HTTP server and attach Socket.IO for live updates
const server = http.createServer(app)
const io = attachRealtime(server)

// Start listening. On a nodemon restart the previous process can still be letting go of the port for a moment,
// so "port in use" is retried for a few seconds before giving up, instead of crashing straight away.
const port = Number(process.env.PORT) || config.port || 7000
const LISTEN_RETRY_MS = 500
const LISTEN_GIVE_UP_MS = 15_000
const listenStarted = Date.now()
let warnedBusy = false

server.on('error', (error) => {
  if (error.code !== 'EADDRINUSE') throw error
  if (Date.now() - listenStarted < LISTEN_GIVE_UP_MS) {
    if (!warnedBusy) logger.warn(`Port ${port} is still busy (previous instance shutting down?); waiting for it...`)
    warnedBusy = true
    setTimeout(() => server.listen(port), LISTEN_RETRY_MS)
    return
  }
  logger.error(`Port ${port} is already in use by another program. Stop it (or run "npm run dev", which frees it automatically) or change PORT in .env.`)
  process.exit(1)
})

server.once('listening', () => {
  logger.info(`Multi-Branch Pharmacy Inventory server listening on http://localhost:${port}`)

  // Background scheduled tasks
  schedule('*/5 * * * *', 'expire-inactive-sessions', () => expireInactiveSessions())
  schedule('0 2 * * *', 'prune-old-sessions', () => pruneOldSessions(), { timezone: config.timezone })
})
server.listen(port)

// Graceful shutdown: let go of the port at once (open websockets and keep-alive connections would otherwise hold it
// for seconds and make the next instance fail), then close the database pool.
let shuttingDown = false
const shutdown = () => {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('Shutting down server...')
  setTimeout(() => process.exit(0), 3_000).unref()
  io?.close() // disconnects every Socket.IO client and closes the HTTP server
  server.close(() => pool.end().finally(() => process.exit(0)))
  server.closeAllConnections?.()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
process.on('SIGUSR2', shutdown) // nodemon's restart signal

// Safety net: an async error nobody awaited is logged instead of taking the whole server down for every user
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled async error (a missing await?)', { error: error?.message, stack: error?.stack?.split('\n').slice(0, 4).join(' | ') })
})

export default app
