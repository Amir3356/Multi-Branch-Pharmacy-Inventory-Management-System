import procurementsRouter from './procurement.routes.js'
import categoriesRouter from './category.routes.js'
import internalRouter from './internal.routes.js'

/** Mounts every feature router of this service */
export function registerRoutes(app) {
  // Before the procurement routes, so /procurements/categories is never read as a procurement id
  app.use(categoriesRouter)
  app.use(procurementsRouter)
  app.use('/internal', internalRouter)
}
