import { Router } from '../utils/index.js'
import { requireActiveBranch, requireRole } from '../middleware/index.js'
import { validateStoreExpense } from '../middleware/validators/expense.validator.js'
import * as controller from '../controllers/expense.controller.js'

// A branch's expenses, recorded by its Inventory Officer; the Owner and Purchase Officer can read all
const router = Router()

router.get('/expenses', requireRole('inventory_officer', 'owner', 'purchase_officer'), controller.index)
// A deactivated (closed) branch records none
router.post('/expenses', requireRole('inventory_officer'), requireActiveBranch('record expenses'), validateStoreExpense, controller.store)
router.delete('/expenses/:expense', requireRole('inventory_officer'), controller.destroy)

export default router
