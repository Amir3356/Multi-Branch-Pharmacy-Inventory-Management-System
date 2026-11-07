import { Router } from '../utils/index.js'
import { requireAuth, requireRole } from '../middleware/index.js'
import { validateStoreSale } from '../middleware/validators/sale.validator.js'
import * as controller from '../controllers/sale.controller.js'

// Sales: the Cashier records them at their branch; every screen's stock follows
const router = Router()

router.get('/sales', requireAuth, controller.index)
router.post('/sales', requireRole('cashier'), validateStoreSale, controller.store)

export default router
