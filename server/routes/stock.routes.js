import { Router } from '../utils/index.js'
import { requireActiveBranch, requireAuth, requireRole } from '../middleware/index.js'
import { bindStockBatch } from '../middleware/bindings.js'
import { validateUpdate } from '../middleware/validators/stock.validator.js'
import * as stockController from '../controllers/stock.controller.js'

/**
 * Each branch's stock per batch, as the server holds it: every screen shows this instead of working it out itself.
 *   GET   /stock              everyone: their branch, or every branch for those who cover all
 *   PATCH /stock/:stockBatch  Inventory Officer, at their own (active) branch: correct units and expiry
 */
export const stockRouter = Router()

stockRouter.get('/stock', requireAuth, stockController.index)
// Route-model binding runs after the role check and before branch.active, as in Laravel's middleware order
stockRouter.patch('/stock/:stockBatch', requireRole('inventory_officer'), bindStockBatch, requireActiveBranch('correct stock'), validateUpdate, stockController.update)
