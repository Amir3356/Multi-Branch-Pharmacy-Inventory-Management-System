import { ROLES, Router } from '../utils/index.js'
import { requireRole } from '../middleware/index.js'
import { loadAccessReview } from '../middleware/loaders/accessReview.loader.js'
import { validateGenerateAccessReview } from '../middleware/validators/accessReview.validator.js'
import * as accessReviewController from '../controllers/accessReview.controller.js'

/**
 * User (access review) reports on the Account Provision page (Owner only; Laravel's AccessReviewController)
 *   GET    /access-reviews                 the newest 50, without their row tables
 *   POST   /access-reviews                 generate one
 *   GET    /access-reviews/:accessReview   one report with its rows
 *   DELETE /access-reviews/:accessReview
 */
const router = Router()
const owner = requireRole(ROLES.OWNER)

router.get('/access-reviews', owner, accessReviewController.index)
router.post('/access-reviews', owner, validateGenerateAccessReview, accessReviewController.store)
router.get('/access-reviews/:accessReview', owner, loadAccessReview, accessReviewController.show)
router.delete('/access-reviews/:accessReview', owner, loadAccessReview, accessReviewController.destroy)

export default router
