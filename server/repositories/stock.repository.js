import { one, productKey, query } from '../utils/index.js'
import { nowSeconds } from '../utils/support.js'

/**
 * stock_batches SQL (StockRepository's queries). The changes run inside the transaction that saves the record moving
 * the units (stock.service.js checks that and decides what a refused change means).
 */

// ---- Reading ----

/** Every products row { id, name, category }, to fill in a batch's catalog id */
export const catalog = (client) => query('select id, name, category from products', [], client)

export const findByIds = (ids, client) => query('select * from stock_batches where id = any($1::bigint[]) order by id', [ids], client)

/** Every batch the user may see (their branch, or all for those who cover every branch), newest first */
export const visibleRows = (user) =>
  user.coversAllBranches
    ? query('select * from stock_batches order by received_at desc, id desc')
    : query('select * from stock_batches where branch_id = $1 order by received_at desc, id desc', [user.branchId])

export const findBatch = (id) => one('select * from stock_batches where id = $1', [id])

export const findByKey = (client, branchId, key, batch) =>
  one('select * from stock_batches where branch_id = $1 and product_key = $2 and batch = $3', [branchId, key, batch], client)

export const lockBatch = (client, id) => one('select * from stock_batches where id = $1 for update', [id], client)

/**
 * Each batch's expiry date ('YYYY-MM-DD', or null when none) for the batches of a product a branch holds; batches
 * missing from the result aren't in that branch's stock.
 */
export async function batchExpiries(branchId, product, batches, client) {
  const rows = await query(
    'select batch, expiry_date from stock_batches where branch_id = $1 and product_key = $2 and batch = any($3::text[])',
    [branchId, productKey(product), batches],
    client,
  )
  return Object.fromEntries(rows.map((r) => [r.batch, r.expiry_date ?? null]))
}

// ---- Changing ----

/** Units arriving at a branch under a batch: added to that batch, or a new batch row. Returns { id }. */
export const upsert = (client, { branchId, product, category, medId, batch, expiry, units, receivedAt }, now) =>
  one(
    `insert into stock_batches (branch_id, product, product_key, category, med_id, batch, expiry_date, received_at, units, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     on conflict (branch_id, product_key, batch)
     do update set units = stock_batches.units + excluded.units, updated_at = excluded.updated_at
     returning id`,
    [branchId, product, productKey(product), category, medId ?? null, batch, expiry ?? null, receivedAt ?? null, units, now],
    client,
  )

/**
 * One guarded UPDATE (units >= n), which locks the batch row until the transaction ends. With expiredAction an expired
 * batch is left alone too. Returns the batch row afterwards, or null when nothing was taken.
 */
export const takeUnits = (client, branchId, key, batch, units, expiredAction, today) =>
  one(
    `update stock_batches set units = units - $4, updated_at = $5
     where branch_id = $1 and product_key = $2 and batch = $3 and units >= $4
       ${expiredAction ? 'and (expiry_date is null or expiry_date >= $6)' : ''}
     returning *`,
    expiredAction ? [branchId, key, batch, units, nowSeconds(), today] : [branchId, key, batch, units, nowSeconds()],
    client,
  )

/** Adds units back to a batch (a released take); returns { id } of the batch, or undefined when it no longer exists */
export async function putBack(client, branchId, key, batch, qty) {
  const row = await client.query(
    'update stock_batches set units = units + $4, updated_at = $5 where branch_id = $1 and product_key = $2 and batch = $3 returning id',
    [branchId, key, batch, qty, nowSeconds()],
  )
  return row.rows[0]
}

export async function setUnitsAndExpiry(client, id, units, expiry, now) {
  await client.query('update stock_batches set units = $2, expiry_date = $3, updated_at = $4 where id = $1', [id, units, expiry, now])
}

/** stock_adjustments: the record of an Inventory Officer's correction */
export async function insertAdjustment(client, { branchId, product, batch, unitsBefore, unitsAfter, expiryBefore, expiryAfter, adjustedBy }, now) {
  await client.query(
    `insert into stock_adjustments (branch_id, product, batch, units_before, units_after, expiry_before, expiry_after, adjusted_by, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [branchId, product, batch, unitsBefore, unitsAfter, expiryBefore, expiryAfter, adjustedBy, now],
  )
}
