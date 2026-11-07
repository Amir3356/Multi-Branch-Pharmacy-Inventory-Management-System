import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'

/** user-service: staff accounts, invitations and access reviews. Routes are mounted in routes/index.js. */
createService({ name: 'user-service', key: 'user', routes: registerRoutes })
