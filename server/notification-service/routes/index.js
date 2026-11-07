import { internalRouter } from './internal.routes.js'

export function registerRoutes(app) {
  app.use(internalRouter)
}
