import { HttpError, abort, audit, isUniqueViolation, money, transaction } from '../utils/index.js'
import { nowSeconds } from '../utils/time.js'
import { round, toInt } from '../utils/helpers.js'
import { modelNotFound } from '../utils/support.js'
import { IDEMPOTENCY_CONSTRAINT, MODEL_CLASS, awaitsReceipt } from '../models/procurement.model.js'
import * as procurements from '../repositories/procurement.repository.js'
import { procurementChanged } from './procurementEvents.service.js'
import { receiveStock } from './stockMovement.service.js'

// Route-model binding for {procurement}
export async function findOrFail(id) {
  const procurement = await procurements.find(id)
  if (!procurement) throw modelNotFound(MODEL_CLASS, id)
  return procurement
}

/** Every signed-in role needs paid procurements: they add to branch stock that inventory and reports show */
export function visibleTo(user) {
  return procurements.visibleTo(user)
}

/**
 * Records an order the Purchase Officer has already paid the supplier for. It is saved as Paid, ready for the
 * receiving branch's Inventory Officer to add to stock (Receive Stock). Recorded once per officer and idempotency key:
 * returns { procurement, created }, and a repeat (a retry after a lost response, a double tap) returns the order
 * already recorded with created = false instead of recording it twice.
 */
export async function create(req, data) {
  const { procurement, created } = await createOnce(req, data)

  // The same key with a different order is a mistake on the client, not a retry
  if (!created && !sameOrder(procurement, data)) {
    throw new HttpError(
      422,
      `This order was already recorded as ${procurement.id} (${procurement.qty} × ${procurement.product}). Close this window and start a new purchase.`,
    )
  }
  if (!created) return { procurement, created }

  audit(req, {
    module: 'Procurement',
    action: 'Procurement created',
    recordId: procurement.id,
    description: `${procurement.qty} × ${procurement.product} from ${procurement.supplier} for ${money(procurement.total, procurement.currency)}.`,
    branchId: procurement.branch_id,
    type: 'create',
    after: procurement,
  })
  // New order: shows on other screens (e.g. the receiving branch's Receive Stock) right away
  procurementChanged(procurement)

  return { procurement, created }
}

async function createOnce(req, data) {
  const existing = await procurements.findByIdempotencyKey(req.user.id, data.idempotencyKey)
  if (existing) return { procurement: existing, created: false }
  try {
    const procurement = await transaction((client) => procurements.createPaid(client, data, req.user.id))
    return { procurement, created: true }
  } catch (error) {
    // Two copies of the same request at the same moment: the other one got in first
    if (isUniqueViolation(error, IDEMPOTENCY_CONSTRAINT)) {
      const winner = await procurements.findByIdempotencyKey(req.user.id, data.idempotencyKey)
      if (winner) return { procurement: winner, created: false }
    }
    throw error
  }
}

function sameOrder(procurement, data) {
  return (
    procurement.branch_id === data.branchId &&
    procurement.supplier === data.supplier &&
    procurement.product === data.product &&
    procurement.med_id === (data.medId ?? null) &&
    procurement.qty === toInt(data.qty) &&
    Number(procurement.total) === round(data.totalCost, 2) &&
    procurement.currency === data.currency
  )
}

/** Adds a paid order's stock to the Inventory Officer's branch, once. Returns the updated row. */
export async function receive(req, procurement, data) {
  // The "Procurement receipt" recipe: inventory-service generates the batch number (BT-00001, …), adds the units and
  // sets the product's shared prices (what one unit cost on this order, what it sells for at every branch). The
  // reference makes a retry after a failed save get the same batch back instead of adding the units twice.
  const received = await transaction(async (client) => {
    const locked = await procurements.lockForUpdate(client, procurement.id)
    if (!awaitsReceipt(locked)) {
      abort(422, locked.received_at ? 'This procurement was already added to stock.' : 'Only a paid procurement can be added to stock.')
    }
    const receivedAt = nowSeconds()
    const stock = await receiveStock(
      {
        reference: `procurement:${locked.id}`,
        branchId: locked.branch_id,
        product: locked.product,
        category: locked.category,
        medId: locked.med_id,
        expiry: data.expiryDate,
        units: locked.qty,
        receivedAt: receivedAt.toISOString(),
        purchasePrice: Number(locked.unit_price),
        sellingPrice: Number(data.sellingPrice),
      },
      req.user,
    )
    return procurements.update(
      locked.id,
      { received_at: receivedAt, received_by: req.user.id, batch: stock.batch, expiry_date: data.expiryDate },
      client,
    )
  })

  // inventory-service already announced products.changed (and stock.changed)
  procurementChanged(received)
  audit(req, {
    module: 'Procurement',
    action: 'Stock added',
    recordId: received.id,
    description: `${received.qty} × ${received.product} added as batch ${received.batch} (expires ${data.expiryDate}), selling at ${money(data.sellingPrice)}.`,
    branchId: received.branch_id,
    type: 'approve',
    before: procurement,
    after: received,
  })

  return received
}
