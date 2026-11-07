import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'

/** branch-service: branches and the store-wide settings (policy). Routes are mounted in routes/index.js. */
createService({ name: 'branch-service', key: 'branch', routes: registerRoutes })
