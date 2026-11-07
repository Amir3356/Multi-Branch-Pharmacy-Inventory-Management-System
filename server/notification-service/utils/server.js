import express from 'express'
import { servicePort } from './config.js'
import { internalOnly } from '../middleware/internalOnly.js'
import { HttpError } from './errors.js'
import { logger, setServiceName } from './logger.js'

/**
 * Builds and starts this service: JSON bodies, every route behind internalOnly (only the gateway and other services
 * may call it), GET /health, errors as JSON ({ message, errors? }), unknown routes as 404. This service keeps no data,
 * so unlike the others its health check doesn't touch the database. Returns { app, server } (Socket.IO attaches to
 * the server).
 */
export function createService({ name, key, routes, onStart, bodyLimit = '1mb' }) {
  setServiceName(name)
  const app = express()
  app.disable('x-powered-by')

  app.get('/health', (req, res) => res.json({ service: name, status: 'ok' }))

  app.use(express.json({ limit: bodyLimit }))
  app.use(internalOnly)

  routes(app)

  app.use((req, res) => res.status(404).json({ message: `The route ${req.path} could not be found.` }))

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error instanceof HttpError) return res.status(error.status).json(error.toJSON())
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ message: 'The request body is not valid JSON.' })
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error?.message })
    res.status(500).json({ message: 'Server Error' })
  })

  const port = servicePort(key)
  const server = app.listen(port, () => {
    logger.info(`${name} listening on http://localhost:${port}`)
    onStart?.()
  })

  const shutdown = () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5_000).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  return { app, server }
}

export const Router = express.Router
