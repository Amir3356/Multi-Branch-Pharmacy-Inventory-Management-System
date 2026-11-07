import { storeToday, productKey, transaction } from '../utils/index.js'
import {
  adjustments as readAdjustments,
  damagedItems,
  deleteAllBatches,
  insertBatches,
  lockStockBatches,
  receivedProcurements,
  receivedTransfers,
  sales as readSales,
  sentTransfers,
} from '../repositories/stockRebuild.repository.js'

/**
 * StockRebuilder: works out every branch's stock per batch from the records and saves it to stock_batches, replacing
 * what is there. Received procurements and received transfers add a batch; transfers sent, sales and damaged items take
 * units out of the named batch, or first-in, first-out (not-expired batches, oldest first) when that batch isn't known;
 * corrections (stock_adjustments) move a batch by what they changed it by and set its expiry.
 * Returns { batches, belowZero } — those below zero are saved as 0.
 */
export async function rebuildStock() {
  return transaction(async (client) => {
    // Holds back every sale, transfer, damaged item and receipt until the new figures are saved
    await lockStockBatches(client)

    const batches = await replay(client)
    const belowZero = batches.filter((b) => b.stock < 0)
    const now = new Date(Math.floor(Date.now() / 1000) * 1000)

    await deleteAllBatches(client)
    for (let i = 0; i < batches.length; i += 500) {
      const chunk = batches.slice(i, i + 500)
      await insertBatches(client, chunk, now)
    }

    return { batches: batches.length, belowZero }
  })
}

// Sort keys like PHP's sortBy on these values: null first, then by time
const time = (value) => (value === null || value === undefined ? -Infinity : new Date(value).getTime())
const stableSortBy = (items, key) => items.map((item, i) => [item, i]).sort(([a, i], [b, j]) => time(a[key]) - time(b[key]) || i - j).map(([item]) => item)
const dateOnly = (value) => (value ? String(value).slice(0, 10) : null)

async function replay(client) {
  const rows = new Map()
  const today = storeToday()
  const keyOf = (branch, product, batch) => `${branch}|${productKey(product)}|${batch}`

  const arrivals = stableSortBy(
    [...(await receivedProcurements(client)), ...(await receivedTransfers(client))],
    'received_at',
  )

  for (const a of arrivals) {
    const key = keyOf(a.branch, a.product, a.batch)
    if (!rows.has(key)) {
      rows.set(key, {
        branchId: a.branch,
        product: a.product,
        category: a.category,
        medId: a.med_id,
        batch: a.batch,
        expiry: dateOnly(a.expiry),
        receivedAt: a.received_at,
        stock: 0,
      })
    }
    rows.get(key).stock += Number(a.qty)
  }

  // Units leave in the order they happened, so FIFO picks the same batches the app does
  const transfers = await sentTransfers(client)
  const damaged = await damagedItems(client)
  const sales = await readSales(client)
  const adjustments = await readAdjustments(client)

  const out = stableSortBy(
    [
      ...transfers.map((t) => ({ branch: t.branch, product: t.product, parts: [[t.batch, Number(t.qty)]], at: t.created_at })),
      ...damaged.map((d) => ({ branch: d.branch, product: d.product, parts: [[d.batch, Number(d.qty)]], at: d.created_at })),
      ...sales.map((s) => {
        const list = Array.isArray(s.batches) ? s.batches : []
        const parts = list.length ? list.map((b) => [b.batch ?? null, Number(b.qty ?? 0)]) : [[null, Number(s.qty)]]
        return { branch: s.branch, product: s.product, parts, at: s.created_at }
      }),
      ...adjustments.map((a) => ({ branch: a.branch_id, product: a.product, adjust: a, at: a.created_at })),
    ],
    'at',
  )

  // A correction from the Inventory screen: the batch moves by what the officer changed it by, and takes the new expiry
  const adjust = (a) => {
    const row = rows.get(keyOf(a.branch_id, a.product, a.batch))
    if (!row) return
    row.stock += a.units_after - a.units_before
    row.expiry = dateOnly(a.expiry_after)
  }

  const takeOut = (branch, product, batch, qty) => {
    const named = batch !== null ? rows.get(keyOf(branch, product, batch)) : null
    if (named) {
      named.stock -= qty
      return
    }

    // The product's batches at the branch: not-expired with stock, oldest first; then the rest
    const mine = [...rows.values()]
      .filter((r) => r.branchId === branch && productKey(r.product) === productKey(product))
      .sort((a, b) => compare(isoOrEmpty(a.receivedAt), isoOrEmpty(b.receivedAt)) || compare(a.batch, b.batch))
    if (!mine.length) return // the app skips it too until the stock arrives
    const fifo = mine.filter((r) => r.stock > 0 && !(r.expiry !== null && r.expiry < today))
    const order = [...fifo, ...mine.filter((r) => !fifo.includes(r))]

    let left = qty
    for (const row of order) {
      if (left <= 0) break
      const units = Math.min(left, Math.max(0, row.stock))
      row.stock -= units
      left -= units
    }
    if (left > 0) order[0].stock -= left
  }

  for (const movement of out) {
    if (movement.adjust) {
      adjust(movement.adjust)
      continue
    }
    for (const [batch, qty] of movement.parts) takeOut(movement.branch, movement.product, batch, qty)
  }

  return [...rows.values()]
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
// PHP compared (string) received_at, '' for none: ISO text of a UTC time sorts the same way
const isoOrEmpty = (value) => (value ? new Date(value).toISOString() : '')
