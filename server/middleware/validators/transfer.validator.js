import { HttpError } from '../../utils/index.js'
import { dateFormatYmd, different, integer, max, min, required, rule, string, validateRules } from '../../utils/rules.js'
import { findActiveBranch } from '../../repositories/branch.repository.js'
import { SELLING_PRICE_RULES } from './product.validator.js'

const activeBranch = async (id) => typeof id === 'string' && Boolean(await findActiveBranch(id))

const storeRules = (user) => ({
  from: [
    required(),
    string(),
    rule(activeBranch, 'Choose an active sending branch.'),
    // Staff send only from their own branch; those who cover every branch from any
    rule((value) => user.coversAllBranches || user.branchId === value, 'You can only send stock from your assigned branch.'),
  ],
  to: [required(), string(), different('from', 'Choose a different branch from the sending branch.'), rule(activeBranch, 'This branch was deactivated by the Owner, so it can’t receive stock. Choose an active branch, or ask the Owner to activate it.')],
  category: [required(), string(), max(120)],
  product: [required(), string(), max(255)],
  medId: [string(), max(20)],
  batch: [required(), string(), max(50)],
  expiry: [dateFormatYmd()],
  qty: [required(), integer(), min(1), max(1000000)],
})

/** POST /transfers → req.validated */
export async function validateStore(req, res, next) {
  req.validated = await validateRules(storeRules(req.user), req.body)
  next()
}

/** POST /transfers/:transfer/receive, after bindTransfer: only the receiving branch, then the selling price → req.validated */
export async function validateReceive(req, res, next) {
  if (req.transfer.to_branch_id !== req.user.branchId) throw new HttpError(403, 'This transfer is for another branch.')

  req.validated = await validateRules(SELLING_PRICE_RULES, req.body)
  next()
}
