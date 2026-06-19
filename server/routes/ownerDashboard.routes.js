import { Router } from '../utils/index.js'
import { requireRole } from '../middleware/index.js'
import { validateDashboardPeriod } from '../middleware/validators/ownerDashboard.validator.js'
import * as ownerDashboardController from '../controllers/ownerDashboard.controller.js'

// The Owner's dashboard: sales, purchases, expenses and profit for a period, for every branch or one
export const ownerDashboardRouter = Router()

ownerDashboardRouter.get('/dashboard/owner', requireRole('owner'), validateDashboardPeriod, ownerDashboardController.show)
