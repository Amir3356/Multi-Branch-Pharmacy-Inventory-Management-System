import { z } from '../../utils/index.js'
import { cleanInput } from '../../utils/helpers.js'
import { NULLABLE, afterOrEqual, dateFormat, inList, integer, max, minNumber, string, validateInput } from '../../utils/validation.js'
import { ACTION_TYPES, MODULES, VIEWABLE_SECTIONS } from '../../models/auditLog.model.js'
import { validateBody } from '../index.js'
import { END_DATE_MESSAGE } from './report.validator.js'

const LIST_RULES = {
  from: [NULLABLE, dateFormat('from')],
  to: [NULLABLE, dateFormat('to'), afterOrEqual('from', END_DATE_MESSAGE)],
  module: [NULLABLE, inList('module', MODULES)],
  type: [NULLABLE, inList('type', ACTION_TYPES)],
  branchId: [NULLABLE, string('branchId'), max('branchId', 20)],
  search: [NULLABLE, string('search'), max('search', 100)],
  page: [NULLABLE, integer('page'), minNumber('page', 1)],
}

/** The Audit Logs page's filters (Laravel's 422 on failure); the validated fields go to req.validatedQuery */
export async function validateAuditLogFilters(req, res, next) {
  req.validatedQuery = await validateInput(cleanInput(req.query), LIST_RULES)
  next()
}

/** POST /audit-logs/views: { section } a signed-in user just opened (a client page key) */
export const validatePageView = validateBody(
  z.object({ section: z.enum(Object.keys(VIEWABLE_SECTIONS), { error: 'Unknown page.' }) }),
)
