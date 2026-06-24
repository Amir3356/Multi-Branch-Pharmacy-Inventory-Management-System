import { Router } from '../utils/index.js'
import { requireRole, throttle } from '../middleware/index.js'
import { validateAiScope, validateChat } from '../middleware/validators/ai.validator.js'
import * as aiController from '../controllers/ai.controller.js'

/**
 * AI Assistance, for the Owner only: recommendations and questions about the business, for the period and branch the
 * Owner chooses. Each AI call costs time and quota, so 20 a minute (one counter for both routes).
 */
export const aiRouter = Router()

const guard = [requireRole('owner'), throttle(20, 1, 'ai')]

aiRouter.get('/ai/recommendations', ...guard, validateAiScope, aiController.recommendations)
aiRouter.post('/ai/chat', ...guard, validateChat, validateAiScope, aiController.chat)
