import { auditLogRouter } from './auditLog.routes.js'
import { internalRouter } from './internal.routes.js'
import { ownerDashboardRouter } from './ownerDashboard.routes.js'
import { reportRouter } from './report.routes.js'

/** Mounts every feature router, in this order */
export function registerRoutes(app) {
  app.use(internalRouter)
  app.use(reportRouter)
  app.use(ownerDashboardRouter)
  app.use(auditLogRouter)
}
