import { authRouter } from './auth.routes.js'
import { internalRouter } from './internal.routes.js'
import { sessionsRouter } from './session.routes.js'

/** Mounts every feature router: service-to-service ones first, then the public ones */
export function registerRoutes(app) {
  app.use(internalRouter)
  app.use(authRouter)
  app.use(sessionsRouter)
}
