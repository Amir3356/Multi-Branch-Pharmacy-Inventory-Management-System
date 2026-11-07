import { HttpError, audit, broadcast, isUniqueViolation, logger, money, nextId, serviceClient, transaction } from '../utils/index.js'
import { nowSeconds, phpInt, phpRound } from '../utils/php.js'
import * as sales from '../repositories/sale.repository.js'
import { IDEMPOTENCY_CONSTRAINT, ID_PREFIX, STATUS_PAID, TABLE, toResource } from '../models/sale.model.js'

const inventory = serviceClient('inventory')

/** The sales this user can see, newest first */
export function visibleTo(user) {
  return sales.visibleTo(user)
}

/**
 * Records a validated sale once per cashier and idempotency key. Returns { sale, created }: a repeat returns the sale
 * already recorded (created = false) instead of selling the units twice.
 */
export async function recordSale(req, data) {
  const unitPrice = phpRound(data.unitPrice, 2)
  const qty = phpInt(data.qty)
  const { sale, created } = await recordOnce(req, {
    branch_id: data.branchId,
    customer: data.customer,
    category: data.category,
    product: data.product,
    med_id: data.medId ?? null,
    qty,
    batches: Object.values(data.batches).map((b) => ({ batch: b.batch, qty: phpInt(b.qty) })),
    unit_price: unitPrice,
    total: phpRound(unitPrice * qty, 2),
    status: STATUS_PAID,
    sold_by: req.user.id,
    idempotency_key: data.idempotencyKey,
    created_at: nowSeconds(),
  })

  // The same key with a different sale is a mistake on the client, not a retry
  if (!created && !sameSale(sale, data, unitPrice)) {
    throw new HttpError(
      422,
      `This sale was already recorded as ${sale.id} (${sale.qty} × ${sale.product}). Close this window and start a new sale.`,
    )
  }

  if (created) {
    broadcast(`branch.${sale.branch_id}.sales`, 'sale.recorded', { sale: toResource(sale) })
    const from = (sale.batches ?? []).map((b) => `${b.batch} × ${b.qty}`).join(', ')
    audit(req, {
      module: 'Sales',
      action: 'Sale recorded',
      recordId: sale.id,
      description: `${sale.qty} × ${sale.product} sold to ${sale.customer} for ${money(sale.total)}${from ? ` (batches ${from})` : ''}.`,
      branchId: sale.branch_id,
      after: sale,
    })
  }

  return { sale, created }
}

function sameSale(sale, data, unitPrice) {
  return (
    sale.branch_id === data.branchId &&
    sale.product === data.product &&
    sale.med_id === (data.medId ?? null) &&
    sale.qty === phpInt(data.qty) &&
    Number(sale.unit_price) === unitPrice &&
    sale.customer === data.customer
  )
}

/**
 * Records the sale once per cashier and idempotency key (the "Sales (saga)" recipe in ARCHITECTURE.md). Returns
 * { sale, created }: when the key was already used (a retry, or two copies of the same request at the same moment) it
 * returns the earlier sale and created = false.
 *
 * Stock lives in inventory-service, so the units are taken first under a reference derived from the key: a second copy
 * of the request repeats the same reference and gets the first take's result without moving units twice. Not enough
 * units (another Cashier sold them a moment ago) is inventory's 422, passed through unchanged.
 */
export async function recordOnce(req, attributes) {
  const existing = await sales.findByIdempotencyKey(attributes.sold_by, attributes.idempotency_key)
  if (existing) return { sale: existing, created: false }

  const reference = `sale:${attributes.sold_by}:${attributes.idempotency_key}`
  await inventory.post(
    '/internal/stock/take',
    { reference, branchId: attributes.branch_id, product: attributes.product, parts: attributes.batches, expiredAction: 'sold' },
    { req },
  )

  try {
    const sale = await transaction(async (client) => sales.insert(client, { ...attributes, id: await nextId(client, TABLE, ID_PREFIX) }))
    return { sale: { ...sale, seller_name: req.user.fullName }, created: true }
  } catch (error) {
    if (isUniqueViolation(error, IDEMPOTENCY_CONSTRAINT)) {
      // The other copy got in first. It took the same reference, so its units are the ones taken: nothing to release.
      const winner = await sales.findByIdempotencyKey(attributes.sold_by, attributes.idempotency_key)
      if (winner) return { sale: winner, created: false }
    }
    // Our sale wasn't saved: put the units back so stock matches the sales on record
    await inventory
      .post('/internal/stock/release', { reference }, { req })
      .catch((releaseError) => logger.error('Stock not released after a failed sale', { reference, error: releaseError.message }))
    throw error
  }
}
