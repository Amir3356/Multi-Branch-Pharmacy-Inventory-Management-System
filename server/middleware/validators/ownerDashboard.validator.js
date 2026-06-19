import { cleanInput } from '../../utils/helpers.js'
import { validateInput } from '../../utils/validation.js'
import { PERIOD_RULES } from './report.validator.js'

/** The Owner's dashboard takes the same period as the reports; the validated fields go to req.validatedQuery */
export async function validateDashboardPeriod(req, res, next) {
  req.validatedQuery = await validateInput(cleanInput(req.query), PERIOD_RULES)
  next()
}
