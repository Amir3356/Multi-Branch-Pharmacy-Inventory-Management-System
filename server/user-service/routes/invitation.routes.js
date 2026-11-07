import { Router } from '../utils/index.js'
import { throttle } from '../middleware/index.js'
import { validateAcceptInvitation } from '../middleware/validators/invitation.validator.js'
import * as invitationController from '../controllers/invitation.controller.js'

/**
 * Public: the invited person opens the emailed link, then sets a password (Laravel's InvitationController)
 *   GET  /invitations/:token
 *   POST /invitations/:token/accept   sets the password and signs the person straight in
 */
const router = Router()

// One limiter for both routes: Laravel's named throttle (throttle:20,1,invitations) shared its counter between them
const invitationLimit = throttle(20, 1, 'invitations')

router.get('/invitations/:token', invitationLimit, invitationController.show)
router.post('/invitations/:token/accept', invitationLimit, validateAcceptInvitation, invitationController.accept)

export default router
