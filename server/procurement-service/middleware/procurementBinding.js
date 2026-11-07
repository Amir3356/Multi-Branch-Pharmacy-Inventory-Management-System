import { abort } from '../utils/index.js'
import { findOrFail } from '../services/procurement.service.js'

/** Route-model binding for {procurement}: req.procurement, or Laravel's 404 */
export async function bindProcurement(req, res, next) {
  req.procurement = await findOrFail(req.params.procurement)
  next()
}

/** An Inventory Officer adds stock only for orders bought for their own branch */
export function requireReceivingBranch(req, res, next) {
  if (req.procurement.branch_id !== req.user.branchId) abort(403, 'This procurement was bought for another branch.')
  next()
}
