import { Router } from '../utils/index.js'
import { requireAuth, requireRole } from '../middleware/index.js'
import { bindTransfer } from '../middleware/bindings.js'
import { validateReceive, validateStore } from '../middleware/validators/transfer.validator.js'
import * as transferController from '../controllers/transfer.controller.js'

/**
 * Stock moving between branches: sent by one branch, added to stock by the other.
 *   GET  /transfers                     everyone (stock depends on them)
 *   POST /transfers                     Inventory Officer (from their branch) or Owner
 *   POST /transfers/:transfer/receive   the receiving branch's Inventory Officer
 */
export const transferRouter = Router()

transferRouter.get('/transfers', requireAuth, transferController.index)
transferRouter.post('/transfers', requireRole('inventory_officer', 'owner'), validateStore, transferController.store)
transferRouter.post('/transfers/:transfer/receive', requireRole('inventory_officer'), bindTransfer, validateReceive, transferController.receive)
