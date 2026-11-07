import { ROLES, Router } from '../utils/index.js'
import { requireAuth, requireRole } from '../middleware/index.js'
import { loadBranch } from '../middleware/loaders/branch.loader.js'
import { validateStoreBranch, validateUpdateBranch } from '../middleware/validators/branch.validator.js'
import * as branchController from '../controllers/branch.controller.js'

/**
 * Branches (Laravel's BranchController)
 *   GET    /branches            every signed-in role (labels, pickers)
 *   POST   /branches            Owner
 *   PATCH  /branches/:branch    Owner
 *   DELETE /branches/:branch    Owner
 */
const router = Router()
const owner = requireRole(ROLES.OWNER)

router.get('/branches', requireAuth, branchController.index)
router.post('/branches', owner, validateStoreBranch, branchController.store)
router.patch('/branches/:branch', owner, loadBranch, validateUpdateBranch, branchController.update)
router.delete('/branches/:branch', owner, loadBranch, branchController.destroy)

export default router
