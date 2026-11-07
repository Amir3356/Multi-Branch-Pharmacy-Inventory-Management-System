import { Router } from '../utils/index.js'
import { requireRole, throttle } from '../middleware/index.js'
import { validateChat } from '../middleware/validators/ai.validator.js'
import * as aiController from '../controllers/ai.controller.js'

/**
 * AI Assistance for every role: recommendations and questions for the signed-in user's role, from the data that role
 * can see. Each AI call costs time and quota, so a user gets 20 a minute (one counter for both routes, as Laravel's
 * throttle:20,1 keyed by user).
 */
export const aiRouter = Router()

const guard = [requireRole('owner', 'inventory_officer', 'cashier', 'purchase_officer'), throttle(20, 1, 'ai')]

aiRouter.get('/ai/recommendations', ...guard, aiController.recommendations)
aiRouter.post('/ai/chat', ...guard, validateChat, aiController.chat)
