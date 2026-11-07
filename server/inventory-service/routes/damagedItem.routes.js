import { Router } from '../utils/index.js'
import { requireActiveBranch, requireAuth, requireRole } from '../middleware/index.js'
import { validateStore } from '../middleware/validators/damagedItem.validator.js'
import * as damagedItemController from '../controllers/damagedItem.controller.js'

/**
 * Damaged stock: the Inventory Officer writes it off at their branch; every screen's stock follows.
 *   GET  /damaged-items   everyone (stock depends on them)
 *   POST /damaged-items   Inventory Officer, at their own active branch
 */
export const damagedItemRouter = Router()

damagedItemRouter.get('/damaged-items', requireAuth, damagedItemController.index)
damagedItemRouter.post('/damaged-items', requireRole('inventory_officer'), requireActiveBranch('record damaged items'), validateStore, damagedItemController.store)
