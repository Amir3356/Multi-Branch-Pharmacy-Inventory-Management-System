import { Router } from '../utils/index.js'
import { requireAuth, requireRole } from '../middleware/index.js'
import { bindProcurement, requireReceivingBranch } from '../middleware/procurementBinding.js'
import { validateReceiveProcurement, validateStoreProcurement } from '../middleware/validators/procurement.validator.js'
import * as controller from '../controllers/procurement.controller.js'

const router = Router()

router.get('/procurements', requireAuth, controller.index)
router.post('/procurements', requireRole('purchase_officer'), validateStoreProcurement, controller.store)
router.post(
  '/procurements/:procurement/receive',
  requireRole('inventory_officer'),
  bindProcurement,
  requireReceivingBranch,
  validateReceiveProcurement,
  controller.receive,
)

export default router
