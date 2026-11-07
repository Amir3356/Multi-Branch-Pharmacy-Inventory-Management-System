import { Router } from '../utils/index.js'
import { requireAuth, requireRole } from '../middleware/index.js'
import { validateAuditLogFilters, validatePageView } from '../middleware/validators/auditLog.validator.js'
import * as auditLogController from '../controllers/auditLog.controller.js'

/**
 * The audit trail. There is deliberately no route to edit or delete an entry, and the table refuses it anyway
 * (migrations/003_audit_trail.sql).
 *   GET  /audit-logs        the Owner's Audit Logs page: newest first, filtered and paged on the server
 *   POST /audit-logs/views  any signed-in user: records that they opened a page
 */
export const auditLogRouter = Router()

auditLogRouter.get('/audit-logs', requireRole('owner'), validateAuditLogFilters, auditLogController.index)
auditLogRouter.post('/audit-logs/views', requireAuth, validatePageView, auditLogController.view)
