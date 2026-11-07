import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'

/** procurement-service: purchase orders and their Chapa payments. Routes are mounted in routes/index.js. */
createService({ name: 'procurement-service', key: 'procurement', routes: registerRoutes })
