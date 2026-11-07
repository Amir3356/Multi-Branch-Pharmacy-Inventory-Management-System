import * as accountService from '../../services/account.service.js'

/** Route-model binding for /accounts/:account: req.account, or Laravel's 404 (before validation runs) */
export async function loadAccount(req, res, next) {
  req.account = await accountService.findOrFail(req.params.account)
  next()
}
