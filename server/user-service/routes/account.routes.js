import { ROLES, Router } from '../utils/index.js'
import { requireRole } from '../middleware/index.js'
import { loadAccount } from '../middleware/loaders/account.loader.js'
import { validateStoreAccount, validateUpdateAccount } from '../middleware/validators/account.validator.js'
import * as accountController from '../controllers/account.controller.js'

/**
 * Account Provision (Owner only): invite, edit, (de)activate and delete staff accounts (Laravel's AccountController)
 *   GET    /accounts
 *   POST   /accounts
 *   PATCH  /accounts/:account
 *   DELETE /accounts/:account
 *   POST   /accounts/:account/resend-invitation
 */
const router = Router()
const owner = requireRole(ROLES.OWNER)

router.get('/accounts', owner, accountController.index)
router.post('/accounts', owner, validateStoreAccount, accountController.store)
router.patch('/accounts/:account', owner, loadAccount, validateUpdateAccount, accountController.update)
router.delete('/accounts/:account', owner, loadAccount, accountController.destroy)
router.post('/accounts/:account/resend-invitation', owner, loadAccount, accountController.resendInvitation)

export default router
