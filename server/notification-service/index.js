import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'
import { attachRealtime } from './services/realtime.service.js'

/**
 * notification-service: emails and live updates. Other services post events to its internal routes; browsers
 * connect to Socket.IO (through the gateway at /socket.io), which runs on this service's HTTP server.
 */
const { server } = createService({ name: 'notification-service', key: 'notification', routes: registerRoutes })
attachRealtime(server)
