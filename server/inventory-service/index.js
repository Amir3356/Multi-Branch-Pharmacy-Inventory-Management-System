import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'

/** inventory-service: the product catalog, stock at every branch, transfers and damaged items. Routes are mounted in routes/index.js. */
createService({ name: 'inventory-service', key: 'inventory', routes: registerRoutes })
