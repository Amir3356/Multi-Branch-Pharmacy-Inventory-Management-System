import { HttpError, broadcast, nextId, productKey, transaction } from '../utils/index.js'
import { toResource as presentProduct } from '../models/product.model.js'
import { claim, findByReference, markReleased, reclaim, saveResult } from '../repositories/stockMovement.repository.js'
import { findProduct, setPrices } from '../repositories/product.repository.js'
import { putBack } from '../repositories/stock.repository.js'
import { add, inBatchOrder, presentRows, stockBroadcaster, takeMany } from './stock.service.js'
import { nowSeconds } from '../utils/support.js'

/**
 * The stock moves other services ask for (sales, procurement receipts). Each carries a unique reference: repeating
 * it returns the first call's stored result and never moves the units twice, so callers can always retry.
 */

// A repeat of a reference: the first call's answer, unless it was another kind of move (or an add that was released)
function replay(movement, kind) {
  if (movement.kind !== kind) throw new HttpError(409, `Stock move ${movement.reference} was already used for another kind of change.`)
  if (movement.released_at) throw new HttpError(409, `Stock move ${movement.reference} was released; send the change again with a new reference.`)
  return movement.result
}

/** Takes all the parts or none, in batch order; → { batches: [stockRow, …] } */
export function takeStock({ reference, branchId, product, parts, expiredAction }) {
  return transaction(async (client) => {
    let claimed = await claim(client, { reference, kind: 'take', branchId, product, parts })
    if (!claimed) {
      // Locked, so a concurrent retry of the same reference waits and then replays this one's result
      const existing = await findByReference(client, reference, { lock: true })
      // A released take retried (e.g. a sale whose save failed, sent again with the same idempotency key): take again
      if (existing.kind === 'take' && existing.released_at) {
        await reclaim(client, existing.id, { branchId, product, parts })
        claimed = existing
      } else {
        return replay(existing, 'take')
      }
    }

    const live = stockBroadcaster(client)
    const rows = await takeMany(client, live, branchId, product, parts, expiredAction ?? null)
    // In batch order, as takeMany returned them
    const result = { batches: await presentRows(rows, client) }
    await saveResult(client, claimed.id, result)
    return result
  })
}

/**
 * Puts back the units of an earlier take (compensation when the caller's own save failed). Adding back is always safe,
 * even if some of those units were sold since. Idempotent: a released move stays released; unknown → false.
 */
export function releaseStock({ reference }) {
  return transaction(async (client) => {
    const movement = await findByReference(client, reference, { lock: true })
    if (!movement) return { released: false }
    if (movement.kind !== 'take') throw new HttpError(409, `Stock move ${reference} added stock; only a take can be released.`)
    if (movement.released_at) return { released: true }

    const live = stockBroadcaster(client)
    const key = productKey(movement.product)
    for (const part of inBatchOrder(movement.parts ?? [])) {
      const row = await putBack(client, movement.branch_id, key, part.batch, Number(part.qty))
      if (row) live.changed(row.id)
    }
    await markReleased(client, movement.id)
    return { released: true }
  })
}

/**
 * Units arriving from a paid procurement: under a newly generated Batch ID (BT-00001, …), the units added, and the product's shared prices set
 * when it is in the catalog and prices are given. → { batch, product } (ProductResource, or null).
 */
export async function receiveStock(input, user) {
  const { reference, branchId, product, category, medId, expiry, units, receivedAt, purchasePrice, sellingPrice } = input
  const pricesGiven = purchasePrice != null || sellingPrice != null

  const { result, pricesSet } = await transaction(async (client) => {
    const claimed = await claim(client, { reference, kind: 'add', branchId, product, parts: [] })
    if (!claimed) return { result: replay(await findByReference(client, reference), 'add'), pricesSet: false }

    // The product's shared prices first, as ProcurementController::receive did before adding the stock
    const catalogRow = medId
      ? pricesGiven
        ? await setPrices(client, medId, purchasePrice ?? null, sellingPrice ?? null, user?.id ?? null)
        : await findProduct(medId, client)
      : null

    // Each receipt gets its own Batch ID, generated here when the Inventory Officer adds the stock
    const batch = await nextId(client, 'batches', 'BT')
    await add(client, stockBroadcaster(client), {
      branchId,
      product,
      category,
      medId: medId ?? null,
      batch,
      expiry: expiry ?? null,
      units,
      receivedAt: receivedAt ? truncateToSeconds(new Date(receivedAt)) : nowSeconds(),
    })

    const result = { batch, product: catalogRow ? presentProduct(catalogRow) : null }
    await saveResult(client, claimed.id, result, [{ batch, qty: units }])
    return { result, pricesSet: Boolean(catalogRow && pricesGiven) }
  })

  if (pricesSet) broadcast('products', 'products.changed', {})
  return result
}

const truncateToSeconds = (date) => new Date(Math.floor(date.getTime() / 1000) * 1000)
