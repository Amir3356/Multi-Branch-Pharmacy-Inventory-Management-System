import { ROLES, Router } from '../utils/index.js'
import { requireAuth, requireRole } from '../middleware/index.js'
import { validateUpdatePolicy } from '../middleware/validators/policy.validator.js'
import * as policyController from '../controllers/policy.controller.js'

/**
 * The store's policy (Laravel's PolicyController): everyone reads it (Low Stock and Expiring Soon depend on it);
 * the Inventory Officer (Policy page) changes it.
 *   GET /policy   signed in
 *   PUT /policy   Inventory Officer
 */
const router = Router()

router.get('/policy', requireAuth, policyController.show)
router.put('/policy', requireRole(ROLES.INVENTORY_OFFICER), validateUpdatePolicy, policyController.update)

export default router
