import { one } from '../utils/index.js'
import { nowSeconds } from '../utils/support.js'

/**
 * stock_movements: one row per reference of a stock move requested by another service. The row is inserted first in
 * the move's transaction. ON CONFLICT DO NOTHING makes a concurrent duplicate wait on the unique reference until the
 * first transaction ends: if that committed, the duplicate inserts nothing (null here) and reads the stored result;
 * if it rolled back, the duplicate inserts and does the move itself. Unlike catching the unique violation, this keeps
 * the duplicate's transaction usable.
 */
export async function claim(client, { reference, kind, branchId, product, parts }) {
  return one(
    `insert into stock_movements (reference, kind, branch_id, product, parts, created_at)
     values ($1, $2, $3, $4, $5::json, $6)
     on conflict (reference) do nothing
     returning id`,
    [reference, kind, branchId, product, JSON.stringify(parts), nowSeconds()],
    client,
  )
}

export const findByReference = (client, reference, { lock = false } = {}) =>
  one(`select * from stock_movements where reference = $1${lock ? ' for update' : ''}`, [reference], client)

export async function saveResult(client, id, result, parts) {
  await client.query(
    'update stock_movements set result = $2::json, parts = coalesce($3::json, parts) where id = $1',
    [id, JSON.stringify(result), parts ? JSON.stringify(parts) : null],
  )
}

export async function markReleased(client, id) {
  await client.query('update stock_movements set released_at = $2 where id = $1', [id, nowSeconds()])
}

/** Reuses a released take's row for a new take of the same reference (the caller retried after compensating) */
export async function reclaim(client, id, { branchId, product, parts }) {
  await client.query(
    'update stock_movements set released_at = null, result = null, branch_id = $2, product = $3, parts = $4::json where id = $1',
    [id, branchId, product, JSON.stringify(parts)],
  )
}
