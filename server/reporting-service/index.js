import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'

/** reporting-service: reports, the Owner dashboard and audit logs. Routes are mounted in routes/index.js. */
createService({ name: 'reporting-service', key: 'reporting', routes: registerRoutes })
