import branchRouter from './branch.routes.js'
import policyRouter from './policy.routes.js'

/** Mounts every feature router of branch-service */
export function registerRoutes(app) {
  app.use(branchRouter)
  app.use(policyRouter)
}
