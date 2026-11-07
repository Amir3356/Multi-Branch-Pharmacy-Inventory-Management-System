import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'

/** sales-service: sales at the till and branch expenses. Routes are mounted in routes/index.js. */
createService({ name: 'sales-service', key: 'sales', routes: registerRoutes })
