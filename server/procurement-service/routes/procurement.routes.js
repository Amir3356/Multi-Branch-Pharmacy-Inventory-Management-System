import { Router } from '../utils/index.js'
import { requireAuth, requireRole, throttle } from '../middleware/index.js'
import { bindProcurement, requireReceivingBranch } from '../middleware/procurementBinding.js'
import { validateReceiveProcurement, validateStoreProcurement } from '../middleware/validators/procurement.validator.js'
import * as controller from '../controllers/procurement.controller.js'

const router = Router()

// Public: Chapa's callback. One limiter for both methods: Laravel counted GET and POST against the same 'chapa' bucket
const chapaThrottle = throttle(60, 1, 'chapa')
router.get('/procurements/chapa/callback', chapaThrottle, controller.chapaCallback)
router.post('/procurements/chapa/callback', chapaThrottle, controller.chapaCallback)

// Public: Chapa's return_url
router.get('/procurements/:procurement/payment-return', controller.paymentReturn)

router.get('/procurements', requireAuth, controller.index)
router.post('/procurements', requireRole('purchase_officer'), validateStoreProcurement, controller.store)
router.post('/procurements/:procurement/verify', requireRole('purchase_officer'), bindProcurement, controller.verify)
router.post(
  '/procurements/:procurement/receive',
  requireRole('inventory_officer'),
  bindProcurement,
  requireReceivingBranch,
  validateReceiveProcurement,
  controller.receive,
)

export default router
