import { Router } from '../utils/index.js'
import { requireAuth, throttle } from '../middleware/index.js'
import { validateForgotPassword, validateLogin, validateResetPassword } from '../middleware/validators/auth.validator.js'
import * as auth from '../controllers/auth.controller.js'

export const authRouter = Router()

// One limiter for both routes: Laravel's throttle:5,1,password-reset group shares one counter
const passwordResetThrottle = throttle(5, 1, 'password-reset')

authRouter.post('/auth/login', validateLogin, auth.login)
authRouter.post('/auth/forgot-password', passwordResetThrottle, validateForgotPassword, auth.forgotPassword)
authRouter.post('/auth/reset-password', passwordResetThrottle, validateResetPassword, auth.resetPassword)
authRouter.get('/auth/me', requireAuth, auth.me)
authRouter.post('/auth/logout', requireAuth, auth.logout)
