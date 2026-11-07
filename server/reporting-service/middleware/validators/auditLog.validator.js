import { z } from '../../utils/index.js'
import { cleanInput } from '../../utils/php.js'
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

const optionalText = z.preprocess((value) => (typeof value === 'number' ? String(value) : value), z.string().nullish().default(null))

const AUDIT_ENTRY = z.object({
  module: z.string({ error: 'The module field is required.' }).min(1, { error: 'The module field is required.' }),
  action: z.string({ error: 'The action field is required.' }).min(1, { error: 'The action field is required.' }),
  recordId: optionalText,
  description: z.preprocess((value) => (value === null || value === undefined ? value : String(value)), z.string({ error: 'The description field is required.' })),
  branchId: optionalText,
  branchName: optionalText,
  actor: z
    .object({ id: z.number().nullish(), fullName: z.string().nullish(), role: z.string().nullish() })
    .nullish()
    .default(null),
  actorName: optionalText,
  type: z.enum(ACTION_TYPES, { error: 'The type field is invalid.' }).nullish().default(null),
  // Snapshots of the record before and after the action (any JSON); reporting-service strips secrets
  before: z.unknown().nullish().default(null),
  after: z.unknown().nullish().default(null),
  ip: optionalText,
  userAgent: optionalText,
})

/** POST /internal/audit-logs: the entry another service records (parsed into req.body) */
export const validateAuditEntry = validateBody(AUDIT_ENTRY)

/** POST /audit-logs/views: { section } a signed-in user just opened (a client page key) */
export const validatePageView = validateBody(
  z.object({ section: z.enum(Object.keys(VIEWABLE_SECTIONS), { error: 'Unknown page.' }) }),
)
