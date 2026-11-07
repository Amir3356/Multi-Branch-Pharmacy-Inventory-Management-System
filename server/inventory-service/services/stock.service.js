import { HttpError, audit, broadcast, formatDate, logger, storeToday, plural, productKey, transaction } from '../utils/index.js'
import { toResources } from '../models/stock.model.js'
import {
  catalog,
  findByIds,
  findByKey,
  insertAdjustment,
  lockBatch,
  setUnitsAndExpiry,
  takeUnits,
  upsert,
  visibleRows,
} from '../repositories/stock.repository.js'
import { nowSeconds } from '../utils/support.js'

/**
 * Every change to a branch's stock (StockRepository). Each runs inside the transaction that saves the record moving
 * the units, so the record and the stock change are saved together or not at all. Taking units is one guarded UPDATE
 * (units >= n), which locks the batch row until that transaction ends: two people taking the last units at the same
 * moment can't both succeed. `live` is the transaction's stockBroadcaster, which announces each change after commit.
 */

/** A batch doesn't hold the units asked for (someone else took them first, or the screen was out of date) */
export const insufficientStock = (message) => new HttpError(422, message)

// ---- StockBroadcaster ----

/**
 * StockBroadcaster: collects the batches one transaction changes and pushes their new figures to each branch once,
 * after it commits (`stock.changed` on `branch.{branchId}.stock`, `{ batches }`). A rolled-back change is never
 * announced, since the after-commit hook never runs. Create one per transaction:
 *
 *   await transaction(async (client) => { const live = stockBroadcaster(client); await take(client, live, …) })
 */
export function stockBroadcaster(client) {
  const pending = new Set()

  return {
    changed(stockBatchId) {
      if (stockBatchId === null || stockBatchId === undefined) return
      // One hook per transaction: it reads `pending` only after commit, so it sees every id the transaction added
      if (!pending.size) client.afterCommit(() => send([...pending]))
      pending.add(stockBatchId)
    },
  }
}

async function send(ids) {
  if (!ids.length) return
  const byBranch = new Map()
  for (const row of await stockRows(ids)) {
    if (!byBranch.has(row.branchId)) byBranch.set(row.branchId, [])
    byBranch.get(row.branchId).push(row)
  }
  for (const [branchId, batches] of byBranch) {
    try {
      broadcast(`branch.${branchId}.stock`, 'stock.changed', { batches })
    } catch (error) {
      logger.warn('Live stock update not sent', { branch: branchId, error: error.message })
    }
  }
}

// ---- Reading ----

/** Batch rows already read, as stock rows, in the same order */
export async function presentRows(rows, client) {
  return toResources(rows, await catalog(client))
}

/** These batches as stock rows (StockRepository::resources) */
export async function stockRows(ids, client) {
  if (!ids.length) return []
  const rows = await findByIds(ids, client)
  return toResources(rows, await catalog(client))
}

/** Every batch the user may see (their branch, or all for those who cover every branch), newest first */
export async function visibleTo(user) {
  const rows = await visibleRows(user)
  return toResources(rows, await catalog())
}

// ---- Changing ----

function requireTransaction(client) {
  if (!client?.inTransaction) throw new Error('Change stock inside the transaction that saves the record moving it.')
}

/** Units arriving at a branch under a batch: added to that batch, or a new batch row. Returns the batch id. */
export async function add(client, live, attributes) {
  requireTransaction(client)
  const now = nowSeconds()
  const row = await upsert(client, attributes, now)
  live.changed(row.id)
  return row.id
}

/**
 * Takes units out of one batch at a branch, only if it holds that many. With expiredAction ('sold', 'sent') an expired
 * batch is refused too. Returns the batch row as it is afterwards; throws a 422 with Laravel's exact message otherwise.
 */
export async function take(client, live, branchId, product, batch, units, expiredAction = null) {
  requireTransaction(client)
  const today = storeToday()
  const key = productKey(product)

  const taken = await takeUnits(client, branchId, key, batch, units, expiredAction, today)
  if (taken) {
    live.changed(taken.id)
    return taken
  }

  const current = await findByKey(client, branchId, key, batch)
  if (!current) {
    throw insufficientStock(`Batch ${batch} of ${product} isn’t in stock at this branch.`)
  }
  if (expiredAction && current.expiry_date && current.expiry_date < today) {
    throw insufficientStock(`Batch ${batch} of ${product} expired on ${formatDate(current.expiry_date)} and can’t be ${expiredAction}.`)
  }
  if (current.units >= units) {
    // Units arrived between the two reads: rare, and trying again works
    throw insufficientStock(`The stock of ${product} just changed. Try again.`)
  }
  throw insufficientStock(
    current.units > 0
      ? `Only ${plural(current.units, 'unit')} of ${product} left in batch ${batch}, not ${units}. Someone else may have just used them: reload the page to see the latest stock.`
      : `Batch ${batch} of ${product} has no units left. Someone else may have just used them: reload the page to see the latest stock.`,
  )
}

/** Parts in a fixed order (by batch number), so two requests sharing batches lock them in the same order: no deadlock */
export const inBatchOrder = (parts) => [...parts].sort((a, b) => (a.batch < b.batch ? -1 : a.batch > b.batch ? 1 : 0))

/** Takes units from several batches of one product, all or none: [{ batch, qty }, …]. Returns the batch rows after. */
export async function takeMany(client, live, branchId, product, parts, expiredAction = null) {
  const after = []
  for (const part of inBatchOrder(parts)) {
    after.push(await take(client, live, branchId, product, part.batch, Number(part.qty), expiredAction))
  }
  return after
}

/**
 * An Inventory Officer's correction: the counted units and the expiry date. `expectedUnits` is what their screen
 * showed; if a sale or another change moved the batch since, the correction is refused (409) instead of silently
 * undoing that change. Kept in stock_adjustments. Returns { before, after } for the audit log.
 */
async function saveCorrection(batchId, expectedUnits, units, expiry, by) {
  return transaction(async (client) => {
    const row = await lockBatch(client, batchId)
    if (row.units !== expectedUnits) {
      throw new HttpError(
        409,
        `The stock of ${row.product} in batch ${row.batch} changed to ${row.units} since you opened this (a sale or another change). Check the new number and save again.`,
      )
    }

    const before = { units: row.units, expiry: row.expiry_date ?? null }
    if (before.units === units && before.expiry === expiry) return { before, after: before }

    const now = nowSeconds()
    await setUnitsAndExpiry(client, row.id, units, expiry, now)
    await insertAdjustment(
      client,
      {
        branchId: row.branch_id,
        product: row.product,
        batch: row.batch,
        unitsBefore: before.units,
        unitsAfter: units,
        expiryBefore: before.expiry,
        expiryAfter: expiry,
        adjustedBy: by.id,
      },
      now,
    )
    stockBroadcaster(client).changed(row.id)

    return { before, after: { units, expiry } }
  })
}

/**
 * PATCH /stock/:stockBatch: corrects the batch, audits what changed, and returns { changes, batch } where batch is the
 * stock row afterwards (or null).
 */
export async function correct(req, batch, data) {
  const { before, after } = await saveCorrection(batch.id, Number(data.expectedStock), Number(data.stock), data.expiry ?? null, req.user)

  const changes = [
    before.units !== after.units ? `stock ${before.units} → ${after.units}` : null,
    before.expiry !== after.expiry ? `expiry ${before.expiry ?? 'none'} → ${after.expiry ?? 'none'}` : null,
  ].filter(Boolean)
  if (changes.length) {
    audit(req, {
      module: 'Inventory',
      action: 'Stock corrected',
      recordId: batch.batch,
      description: `${batch.product} batch ${batch.batch}: ${changes.join(', ')}.`,
      branchId: batch.branch_id,
      before: { product: batch.product, batch: batch.batch, units: before.units, expiry: before.expiry },
      after: { product: batch.product, batch: batch.batch, units: after.units, expiry: after.expiry },
    })
  }

  return { changes, batch: (await stockRows([batch.id]))[0] ?? null }
}
