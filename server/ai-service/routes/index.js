import { aiRouter } from './ai.routes.js'

/** Mounts every feature router */
export function registerRoutes(app) {
  app.use(aiRouter)
}
