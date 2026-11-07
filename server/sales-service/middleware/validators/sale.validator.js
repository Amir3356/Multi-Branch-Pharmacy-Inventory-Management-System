import { storeToday, validationError } from '../../utils/index.js'
import { activeBranchExists, batchExpiries } from '../../repositories/sale.repository.js'
import { normalizeInput, phpFalsyString, phpInt, phpString } from '../../utils/php.js'
import { collectErrors } from '../../utils/validation.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// PHP's date('M j, Y'): always English, whatever the machine's locale
const shortDate = (ymd) => {
  const [year, month, day] = ymd.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

/** StoreSaleRequest: a Cashier's sale at their own, active branch. Leaves the validated input on req.validated. */
export async function validateStoreSale(req, res, next) {
  const input = normalizeInput(req.body ?? {})
  const customer = phpString(input.customer).trim()
  const data = {
    ...input,
    customer: phpFalsyString(customer) ? 'Walk-in Customer' : customer,
    // Sent as the Idempotency-Key header: one per sale on the Cashier's screen, the same on every retry
    idempotencyKey: req.get('Idempotency-Key') ?? null,
  }

  const activeBranch = {
    name: 'exists',
    test: async (value) =>
      (typeof value === 'string' || typeof value === 'number') && (await activeBranchExists(String(value))),
  }
  const ownBranchOnly = (value, fail) => {
    if (req.user.branchId !== value) fail('You can only record sales at your assigned branch.')
  }
  const addsUpToQty = (value, fail) => {
    if (!Array.isArray(value) && (value === null || typeof value !== 'object')) return
    const sum = Object.values(value).reduce((total, b) => total + phpInt(b && typeof b === 'object' ? (b.qty ?? 0) : 0), 0)
    if (sum !== phpInt(data.qty)) fail('The batches must add up to the quantity sold.')
  }

  const errors = await collectErrors(
    data,
    {
      branchId: ['required', 'string', activeBranch, ownBranchOnly],
      customer: ['required', 'string', 'max:120'],
      category: ['required', 'string', 'max:120'],
      product: ['required', 'string', 'max:255'],
      medId: ['nullable', 'string', 'max:20'],
      qty: ['required', 'integer', 'min:1', 'max:1000000'],
      unitPrice: ['required', 'numeric', 'gt:0', 'max:10000000'],
      idempotencyKey: ['required', 'uuid'],
      // Which batches the units come from (first in, first out, chosen on the Cashier's screen); they add up to qty
      batches: ['required', 'array', 'min:1', 'max:50', addsUpToQty],
      'batches.*.batch': ['required', 'string', 'max:50', 'distinct'],
      'batches.*.qty': ['required', 'integer', 'min:1'],
    },
    {
      'branchId.exists': 'This branch is inactive, so it can’t record sales.',
      'idempotencyKey.required': 'This sale is missing its Idempotency-Key header. Reload the page and try again.',
      'idempotencyKey.uuid': 'The Idempotency-Key header must be a UUID.',
      'batches.required': 'Choose which batches the units come from.',
    },
  )

  // Once the fields are valid: every batch must be in this branch's stock and not expired. The Cashier's screen never
  // offers an expired batch; this stops one arriving another way (an out-of-date screen, a direct API call).
  if (!Object.keys(errors).length) {
    const batches = Object.values(data.batches).map((b) => b.batch)
    const expiries = await batchExpiries(data.branchId, data.product, batches)
    const today = storeToday()
    for (const batch of batches) {
      const add = (message) => (errors.batches ??= []).includes(message) || errors.batches.push(message)
      if (!Object.hasOwn(expiries, batch)) add(`Batch ${batch} isn’t in stock at this branch.`)
      else if (expiries[batch] !== null && expiries[batch] < today) add(`Batch ${batch} expired on ${shortDate(expiries[batch])} and can’t be sold.`)
    }
  }

  if (Object.keys(errors).length) throw validationError(errors)
  req.validated = data
  next()
}
