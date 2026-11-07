import { Router } from '../utils/index.js'
import { validateAuditEntry } from '../middleware/validators/auditLog.validator.js'
import * as auditLogController from '../controllers/auditLog.controller.js'

/** Service-to-service routes (see ARCHITECTURE.md) */
export const internalRouter = Router()

internalRouter.post('/internal/audit-logs', validateAuditEntry, auditLogController.store)
