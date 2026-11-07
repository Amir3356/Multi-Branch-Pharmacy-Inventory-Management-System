import { HttpError, abort, audit, money, serviceClient, transaction } from '../utils/index.js'
import { modelNotFound, nowSeconds } from '../utils/php.js'
import { MODEL_CLASS, awaitsReceipt } from '../models/procurement.model.js'
import * as procurements from '../repositories/procurement.repository.js'
import { procurementChanged } from './procurementEvents.service.js'
import { startCheckout, sync } from './procurementPayment.service.js'

const inventory = serviceClient('inventory')

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

/** Chapa's callback only triggers a verify with Chapa, so it can't fake a payment */
export async function handleChapaCallback(txRef, req) {
  const procurement = await procurements.findByTxRef(txRef)
  if (procurement) await sync(procurement, req)
}

/**
 * Saves the order as Pending and starts Chapa's checkout; stock arrives once the payment is verified.
 * CHAPA_MODE=fake has no checkout: the order is paid right here and checkoutUrl is null.
 * Returns { procurement (re-read), checkoutUrl }.
 */
export async function create(req, data) {
  const procurement = await transaction((client) => procurements.createPending(client, data, req.user.id))

  let checkoutUrl
  try {
    checkoutUrl = await startCheckout(procurement, req.user)
  } catch (error) {
    // Nothing to pay for, so don't keep an order that can never be settled
    if (error instanceof HttpError) await procurements.remove(procurement.id)
    throw error
  }

  audit(req, {
    module: 'Procurement',
    action: 'Procurement created',
    recordId: procurement.id,
    description: `${procurement.qty} × ${procurement.product} from ${procurement.supplier} for ${money(procurement.total, procurement.currency)}; awaiting Chapa payment.`,
    branchId: procurement.branch_id,
    type: 'create',
    after: procurement,
  })
  // New Pending order: shows on other screens (e.g. the Owner's) right away
  procurementChanged(procurement)

  const saved = (await procurements.find(procurement.id)) ?? procurement
  // No checkout page to visit (fake mode): confirm the payment now, as the officer's screen would after Chapa
  if (!checkoutUrl) return { procurement: await sync(saved, req), checkoutUrl: null }
  return { procurement: saved, checkoutUrl }
}

/** Checks the payment with Chapa (the Procurement page calls this when Chapa sends the officer back) */
export function verify(procurement, req) {
  return sync(procurement, req)
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
    const stock = await inventory.post(
      '/internal/stock/receive',
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
      { req },
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
