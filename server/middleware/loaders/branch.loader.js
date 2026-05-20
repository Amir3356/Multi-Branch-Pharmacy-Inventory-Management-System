import * as branchService from '../../services/branch.service.js'

/** Route-model binding for /branches/:branch: req.branch, or Laravel's 404 (before validation runs) */
export async function loadBranch(req, res, next) {
  req.branch = await branchService.findOrFail(req.params.branch)
  next()
}
