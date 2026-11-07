import salesRouter from './sale.routes.js'
import expensesRouter from './expense.routes.js'

/** Mounts every feature router of this service */
export function registerRoutes(app) {
  app.use(salesRouter)
  app.use(expensesRouter)
}
