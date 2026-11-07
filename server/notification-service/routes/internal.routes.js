import { sendBroadcast, sendEmail } from '../controllers/notification.controller.js'
import { validateBroadcast, validateEmail } from '../middleware/index.js'
import { Router } from '../utils/index.js'

// Service-to-service only (the gateway never routes /internal)
export const internalRouter = Router()
internalRouter.post('/internal/broadcast', validateBroadcast, sendBroadcast)
internalRouter.post('/internal/email', validateEmail, sendEmail)
