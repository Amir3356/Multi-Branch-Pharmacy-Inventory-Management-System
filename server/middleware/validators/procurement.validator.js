import { storeToday } from '../../utils/index.js'
import { normalizeInput, toCleanString } from '../../utils/helpers.js'
import { validateRules } from '../../utils/validation.js'
import { CURRENCIES } from '../../models/procurement.model.js'
import { activeBranchExists } from '../../repositories/procurement.repository.js'
import { findByName as findCategoryByName } from '../../repositories/category.repository.js'
import { findProductBatch } from '../../repositories/product.repository.js'

/**
 * StoreProcurementRequest. The total is worked out from the Total Cost, never taken as a unit price from the browser.
 * Leaves the validated input on req.validated.
 */
export async function validateStoreProcurement(req, res, next) {
  const data = normalizeInput(req.body ?? {})
  for (const field of ['supplier', 'category', 'product', 'batch']) {
    if (Object.hasOwn(data, field)) data[field] = toCleanString(data[field]).trim()
  }
  data.currency = toCleanString(Object.hasOwn(data, 'currency') ? data.currency : 'ETB').toUpperCase()
  // Sent as the Idempotency-Key header: one per order on the Purchase Officer's screen, the same on every retry
  data.idempotencyKey = req.get('Idempotency-Key') ?? null

  const activeBranch = {
    name: 'exists',
    test: async (value) => (typeof value === 'string' || typeof value === 'number') && (await activeBranchExists(String(value))),
  }
  // The category must be one the Purchase Officer added; it is saved as that list spells it
  const knownCategory = {
    name: 'exists',
    test: async (value) => {
      const category = typeof value === 'string' && value ? await findCategoryByName(value) : null
      if (category) data.category = category.name
      return Boolean(category)
    },
  }
  // The Batch ID picked in Create Procurement must be one the Purchase Officer generated for this product
  // (Category & Product page); the Inventory Officer receives the stock under it
  const productBatch = {
    name: 'exists',
    test: async (value) => typeof value === 'string' && typeof data.medId === 'string' && Boolean(await findProductBatch(data.medId, value)),
  }
  // A Purchase Officer receives stock only into the branch the Owner assigned them in Account Provision
  const assignedBranchOnly = (value, fail) => {
    const user = req.user
    if (!user.coversAllBranches && user.branchId !== value) {
      fail(user.branchId ? 'You can only receive stock into your assigned branch.' : 'You have no assigned branch yet. Ask the Owner to assign one in Account Provision.')
    }
  }

  req.validated = await validateRules(
    data,
    {
      branchId: ['required', 'string', activeBranch, assignedBranchOnly],
      supplier: ['required', 'string', 'max:255'],
      category: ['required', 'string', 'max:120', knownCategory],
      product: ['required', 'string', 'max:255'],
      medId: ['nullable', 'string', 'max:20'],
      batch: ['nullable', 'string', 'max:50', productBatch],
      qty: ['required', 'integer', 'min:1', 'max:1000000'],
      // What the whole order costs; the unit price is worked out from it (Total Cost ÷ Quantity)
      totalCost: ['required', 'numeric', 'gt:0', 'max:10000000000'],
      currency: ['required', { name: 'in', values: CURRENCIES }],
      idempotencyKey: ['required', 'uuid'],
    },
    {
      'branchId.exists': 'Choose an active branch.',
      'category.exists': 'Choose a category from the list. Add new ones on the Category & Product page.',
      'batch.exists': 'Choose a Batch ID of this product from the list. Add new ones on the Category & Product page.',
      'currency.in': 'Orders can only be recorded in ETB or USD. Change the currency in Policy settings.',
      'idempotencyKey.required': 'This order is missing its Idempotency-Key header. Reload the page and try again.',
      'idempotencyKey.uuid': 'The Idempotency-Key header must be a UUID.',
    },
  )
  next()
}

/** Adding a paid order's stock (Receive Stock). Leaves the validated input on req.validated. */
export async function validateReceiveProcurement(req, res, next) {
  // "Today" in the store's local time: stock that has already expired can't be added
  const today = storeToday()
  req.validated = await validateRules(
    normalizeInput(req.body ?? {}),
    {
      expiryDate: ['required', 'date_format:Y-m-d', `after:${today}`],
      sellingPrice: ['required', 'numeric', 'gt:0', 'max:10000000'],
    },
    {
      'expiryDate.required': 'Enter the expiration date printed on the package.',
      'expiryDate.after': 'This stock has already expired; it can’t be added.',
      'sellingPrice.*': 'Enter a selling price greater than 0',
    },
  )
  next()
}
