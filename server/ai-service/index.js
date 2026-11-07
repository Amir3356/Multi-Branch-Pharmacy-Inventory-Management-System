import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'

/** ai-service: the AI assistant. Routes are mounted in routes/index.js. */
createService({ name: 'ai-service', key: 'ai', routes: registerRoutes })
