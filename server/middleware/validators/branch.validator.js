import { normalizeInput, rule, str, validateRules } from '../../utils/rules.js'
import * as branchService from '../../services/branch.service.js'
import { NAME_TAKEN, STATUSES } from '../../models/branch.model.js'

/**
 * BranchRequest: create (POST) and edit (PATCH, every field optional). A field sent empty on an edit is refused like a
 * missing one on create, rather than saved blank (Laravel skipped its rules for an empty value and stored '').
 * Returns only the fields that were sent.
 */
async function validateBranch(body, { creating, branch = null }) {
  const input = normalizeInput(body)
  for (const field of ['name', 'location']) if (Object.hasOwn(input, field)) input[field] = str(input[field]).trim().replace(/\s+/g, ' ')
  if (Object.hasOwn(input, 'status')) input.status = str(input.status).toLowerCase()

  const nameTaken = typeof input.name === 'string' && input.name !== '' && (await branchService.nameTaken(input.name, branch?.id ?? null))
  await validateRules(
    {
      name: { sometimes: !creating, rules: [rule.required(), rule.string(), rule.max(120), rule.check(() => !nameTaken, NAME_TAKEN)] },
      location: { sometimes: !creating, rules: [rule.required(), rule.string(), rule.max(255)] },
      status: { sometimes: true, rules: [{ ...rule.in([...STATUSES]), implicit: true }] },
    },
    input,
  )
  return Object.fromEntries(['name', 'location', 'status'].filter((field) => Object.hasOwn(input, field)).map((field) => [field, input[field]]))
}

/** POST /branches: req.body becomes the validated fields */
export async function validateStoreBranch(req, res, next) {
  req.body = await validateBranch(req.body, { creating: true })
  next()
}

/** PATCH /branches/:branch (after loadBranch): req.body becomes the validated fields */
export async function validateUpdateBranch(req, res, next) {
  req.body = await validateBranch(req.body, { creating: false, branch: req.branch })
  next()
}
