import { REASONS } from '../../models/damagedItem.model.js'
import { batchExpiries } from '../../repositories/stock.repository.js'
import { addError, integer, max, min, oneOf, required, string, validateRules } from '../../utils/rules.js'

const qtyMessage = 'Enter a whole number of at least 1'
const STORE_RULES = {
  medId: [string(), max(20)],
  product: [required(), string(), max(255)],
  category: [required(), string(), max(120)],
  batch: [required(), string(), max(50)],
  qty: [required(qtyMessage), integer(qtyMessage), min(1, qtyMessage), max(1000000, qtyMessage)],
  reason: [required('Select a reason'), oneOf(REASONS, 'Select a reason')],
}

/** POST /damaged-items (StoreDamagedItemRequest) → req.validated */
export async function validateStore(req, res, next) {
  const branchId = req.user.branchId
  req.validated = await validateRules(STORE_RULES, req.body, {
    // The same check a sale gets: the batch must have been added to this branch's stock
    after: async (input, errors) => {
      if (!branchId || errors.batch || errors.product) return
      const expiries = await batchExpiries(branchId, String(input.product ?? ''), [input.batch])
      if (!Object.hasOwn(expiries, input.batch)) addError(errors, 'batchKey', `Batch ${input.batch} isn’t in stock at your branch.`)
    },
  })
  next()
}
