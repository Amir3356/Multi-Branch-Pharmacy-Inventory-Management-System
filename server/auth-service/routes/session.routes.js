import { Router } from '../utils/index.js'
import { requireAuth, requireRole, throttle } from '../middleware/index.js'
import { requireDeviceLocation } from '../middleware/deviceLocation.js'
import { validateDeviceLocation } from '../middleware/validators/session.validator.js'
import * as sessions from '../controllers/session.controller.js'

export const sessionsRouter = Router()

const owner = requireRole('owner')

sessionsRouter.post('/sessions/current/location', requireAuth, throttle(10, 1, 'device-location'), requireDeviceLocation, validateDeviceLocation, sessions.saveLocation)
sessionsRouter.get('/sessions', owner, sessions.index)
sessionsRouter.post('/sessions/:session/end', owner, sessions.end)
sessionsRouter.delete('/sessions/:session', owner, sessions.destroy)
