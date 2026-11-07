import { damagedItemRouter } from './damagedItem.routes.js'
import { internalRouter } from './internal.routes.js'
import { productRouter } from './product.routes.js'
import { stockRouter } from './stock.routes.js'
import { transferRouter } from './transfer.routes.js'

/** Mounts every feature router, in this order */
export function registerRoutes(app) {
  app.use(productRouter)
  app.use(stockRouter)
  app.use(transferRouter)
  app.use(damagedItemRouter)
  app.use('/internal', internalRouter)
}
