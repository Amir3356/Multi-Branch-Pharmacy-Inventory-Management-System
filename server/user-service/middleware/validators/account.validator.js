import { ACCOUNT_STATUSES, ROLES, STAFF_ROLES, coversAllBranches } from '../../utils/index.js'
import { normalizeInput, rule, str, validateRules } from '../../utils/rules.js'
import * as accountService from '../../services/account.service.js'
import { EMAIL_TAKEN } from '../../models/account.model.js'

const isRole = (value) => Object.values(ROLES).includes(str(value))

/** POST /accounts (StoreAccountRequest): req.body becomes the normalized, validated input */
export async function validateStoreAccount(req, res, next) {
  const input = normalizeInput(req.body)
  // StoreAccountRequest::prepareForValidation
  input.fullName = str(input.fullName).trim()
  input.email = str(input.email).trim().toLowerCase()

  const emailTaken = input.email !== '' && (await accountService.emailTaken(input.email))
  const branchExists = typeof input.branchId === 'string' && (await accountService.branchExists(input.branchId))
  validateRules(
    {
      fullName: { rules: [rule.required(), rule.string(), rule.max(120)] },
      email: { rules: [rule.required(), rule.email(), rule.max(255), rule.check(() => !emailTaken, EMAIL_TAKEN)] },
      role: { rules: [rule.required(), rule.in(STAFF_ROLES, 'Choose Inventory Officer, Cashier or Purchase Officer.')] },
      // Inventory Officers and Cashiers work at one branch; the Purchase Officer covers every branch, so none is set
      branchId: {
        nullable: true,
        rules: [
          rule.requiredIf((data) => isRole(data.role) && !coversAllBranches(str(data.role))),
          rule.string(),
          rule.check(() => branchExists, 'Choose a valid branch.'),
        ],
      },
    },
    input,
  )
  req.body = input
  next()
}

/** PATCH /accounts/:account (UpdateAccountRequest, after loadAccount): req.body becomes the normalized, validated input */
export async function validateUpdateAccount(req, res, next) {
  const { account } = req

  // UpdateAccountRequest::prepareForValidation
  const input = normalizeInput(req.body)
  if (Object.hasOwn(input, 'fullName')) input.fullName = str(input.fullName).trim()
  if (Object.hasOwn(input, 'email')) input.email = str(input.email).trim().toLowerCase()
  if (Object.hasOwn(input, 'status')) input.status = str(input.status).toLowerCase()

  const emailTaken = typeof input.email === 'string' && input.email !== '' && (await accountService.emailTaken(input.email, account.id))
  const branchExists = typeof input.branchId === 'string' && (await accountService.branchExists(input.branchId))
  validateRules(
    {
      fullName: { sometimes: true, rules: [rule.required(), rule.string(), rule.max(120)] },
      email: { sometimes: true, rules: [rule.required(), rule.email(), rule.max(255), rule.check(() => !emailTaken, EMAIL_TAKEN)] },
      role: { sometimes: true, rules: [rule.required(), rule.in(STAFF_ROLES)] },
      branchId: { sometimes: true, nullable: true, rules: [rule.string(), rule.check(() => branchExists, 'The selected branch id is invalid.')] },
      status: { sometimes: true, rules: [rule.required(), rule.in([ACCOUNT_STATUSES.ACTIVE, ACCOUNT_STATUSES.INACTIVE])] },
    },
    input,
  )
  req.body = input
  next()
}
