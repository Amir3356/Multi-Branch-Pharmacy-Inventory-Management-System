import { Router } from '../utils/index.js'
import { validateIssueToken, validateUserSessions } from '../middleware/validators/internal.validator.js'
import * as internal from '../controllers/internal.controller.js'

/** Service-to-service (never routed by the gateway) */
export const internalRouter = Router()

internalRouter.post('/internal/auth/introspect', internal.introspect)
// The nginx gateway's auth_request (see api-gateway/nginx.conf)
internalRouter.get('/internal/auth/gateway-check', internal.gatewayCheck)
internalRouter.post('/internal/auth/issue-token', validateIssueToken, internal.issueToken)
internalRouter.post('/internal/sessions/end-all', validateUserSessions, internal.endAllSessions)
internalRouter.post('/internal/sessions/delete-all', validateUserSessions, internal.deleteAllSessions)
