import { nextId, one, pool, query } from '../utils/index.js'
import { nowSeconds } from '../utils/time.js'
import { round, toInt } from '../utils/helpers.js'
import { ID_PREFIX, TABLE, UPDATABLE_COLUMNS } from '../models/procurement.model.js'

// Every database read and write for procurements

/** Newest first: every branch for those who cover all branches, otherwise the user's own branch */
export function visibleTo(user) {
  return user.coversAllBranches
    ? query('select * from procurements order by created_at desc')
    : query('select * from procurements where branch_id = $1 order by created_at desc', [user.branchId])
}

export function find(id, client = pool) {
  return one('select * from procurements where id = $1', [id], client)
}

/** Re-reads the row and locks it until the surrounding transaction ends */
export function lockForUpdate(client, id) {
  return one('select * from procurements where id = $1 for update', [id], client)
}

/** The order this Purchase Officer already recorded with this idempotency key, if any */
export function findByIdempotencyKey(userId, key, client = pool) {
  return one('select * from procurements where created_by = $1 and idempotency_key = $2', [userId, key], client)
}

/** A Paid order with the next free id (PO-00001, …). Call in a transaction. */
export async function createPaid(client, data, createdBy) {
  const id = await nextId(client, TABLE, ID_PREFIX)
  const qty = toInt(data.qty)
  // The officer enters the order's Total Cost; the unit price is derived from it
  const total = round(data.totalCost, 2)
  const now = nowSeconds()
  return one(
    `insert into procurements (id, branch_id, created_by, supplier, category, product, med_id, qty, unit_price, total, currency, status, tx_ref, paid_at, created_at, updated_at, idempotency_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'paid', $1, $12, $12, $12, $13)
     returning *`,
    [
      id,
      data.branchId,
      createdBy,
      data.supplier,
      data.category,
      data.product,
      data.medId ?? null,
      qty,
      round(total / qty, 2).toFixed(2),
      total.toFixed(2),
      data.currency,
      now,
      data.idempotencyKey ?? null,
    ],
    client,
  )
}

/** Updates the given columns (and updated_at) and returns the row */
export function update(id, attributes, client = pool) {
  const entries = Object.entries(attributes)
  for (const [column] of entries) if (!UPDATABLE_COLUMNS.has(column)) throw new Error(`Unknown procurement column ${column}`)
  const sets = entries.map(([column], i) => `${column} = $${i + 2}`)
  return one(
    `update procurements set ${[...sets, `updated_at = $${entries.length + 2}`].join(', ')} where id = $1 returning *`,
    [id, ...entries.map(([, value]) => value), nowSeconds()],
    client,
  )
}

/** Whether the branch exists and is active (branches belong to branch-service; reading them is allowed) */
export async function activeBranchExists(branchId) {
  return Boolean(await one("select 1 from branches where id = $1 and status = 'active'", [branchId]))
}
