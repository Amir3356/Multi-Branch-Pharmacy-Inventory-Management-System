import { HttpError } from '../../utils/index.js'
import { dateFormatYmd, integer, max, min, required, validateRules } from '../../utils/rules.js'

const stockMessage = 'Enter a whole number of 0 or more'
const UPDATE_RULES = {
  stock: [required(stockMessage), integer(stockMessage), min(0, stockMessage), max(1000000, stockMessage)],
  expiry: [dateFormatYmd('Enter a valid date')],
  // The units the screen showed when the form opened
  expectedStock: [required(), integer(), min(0)],
}

/** PATCH /stock/:stockBatch (UpdateStockBatchRequest), after bindStockBatch → req.validated */
export async function validateUpdate(req, res, next) {
  const batch = req.stockBatch
  // UpdateStockBatchRequest::authorize(), checked before validation
  if (batch.branch_id !== req.user.branchId) throw new HttpError(403, 'You can only correct stock at your assigned branch.')

  req.validated = await validateRules(UPDATE_RULES, req.body)
  next()
}
