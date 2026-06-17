import { cleanInput } from '../../utils/helpers.js'
import { NULLABLE, afterOrEqual, dateFormat, exists, required, string, validateInput } from '../../utils/validation.js'

export const END_DATE_MESSAGE = 'The end date must be on or after the start date.'

/** The period every report and the Owner's dashboard take: from, to (store calendar days) and an optional branch */
export const PERIOD_RULES = {
  from: [required('from'), dateFormat('from')],
  to: [required('to'), dateFormat('to'), afterOrEqual('from', END_DATE_MESSAGE)],
  branchId: [NULLABLE, string('branchId'), exists('branchId', 'branches', 'id')],
}

/** Validates a report's period query (Laravel's 422 on failure); the validated fields go to req.validatedQuery */
export async function validateReportPeriod(req, res, next) {
  req.validatedQuery = await validateInput(cleanInput(req.query), PERIOD_RULES)
  next()
}
