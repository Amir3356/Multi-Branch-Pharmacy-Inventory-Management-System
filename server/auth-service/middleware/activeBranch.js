import { one } from '../utils/db.js'
import { HttpError } from '../utils/errors.js'

/**
 * Lets a change through only while the signed-in staff member's branch is active: a deactivated branch is closed, so
 * nothing new is recorded there. Those who cover every branch have none, and pass.
 *   router.post('/expenses', requireRole('inventory_officer'), requireActiveBranch('record expenses'), controller.store)
 */
export function requireActiveBranch(action = 'make changes') {
  return async (req, res, next) => {
    try {
      const branchId = req.user?.branchId
      // branches belong to branch-service; reading them is allowed
      const branch = branchId ? await one('select name, status from branches where id = $1', [branchId]) : null
      if (branch && branch.status !== 'active') {
        throw new HttpError(422, `${branch.name} is inactive, so it can't ${action}. Ask the Owner to activate it first.`)
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
