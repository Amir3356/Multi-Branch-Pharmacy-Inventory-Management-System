import crypto from 'node:crypto'
import { nextId, one, pool, query } from '../utils/index.js'
import { nowSeconds, phpInt, phpRound } from '../utils/php.js'
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

export function findByTxRef(txRef) {
  return one('select * from procurements where tx_ref = $1', [txRef])
}

/** Re-reads the row and locks it until the surrounding transaction ends */
export function lockForUpdate(client, id) {
  return one('select * from procurements where id = $1 for update', [id], client)
}

// Laravel's Str::random(12), lower-cased
function randomSuffix(length = 12) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.randomBytes(length), (byte) => alphabet[byte % alphabet.length]).join('')
}

/** A Pending order with the next free id (PO-00001, …) and a unique Chapa transaction reference. Call in a transaction. */
export async function createPending(client, data, createdBy) {
  const id = await nextId(client, TABLE, ID_PREFIX)
  const qty = phpInt(data.qty)
  // The officer enters the order's Total Cost; Chapa charges exactly that, and the unit price is derived from it
  const total = phpRound(data.totalCost, 2)
  const now = nowSeconds()
  return one(
    `insert into procurements (id, branch_id, created_by, supplier, category, product, med_id, qty, unit_price, total, currency, status, tx_ref, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13, $13)
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
      phpRound(total / qty, 2).toFixed(2),
      total.toFixed(2),
      data.currency,
      `${id}-${randomSuffix()}`,
      now,
    ],
    client,
  )
}

/** Still pending after at least minMinutes, created within the last maxHours: payments to check with Chapa */
export function pendingToVerify(minMinutes, maxHours) {
  const now = Date.now()
  return query("select * from procurements where status = 'pending' and created_at <= $1 and created_at >= $2", [
    new Date(now - minMinutes * 60_000),
    new Date(now - maxHours * 3_600_000),
  ])
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

export async function remove(id) {
  await query('delete from procurements where id = $1', [id])
}

/** Whether the branch exists and is active (branches belong to branch-service; reading them is allowed) */
export async function activeBranchExists(branchId) {
  return Boolean(await one("select 1 from branches where id = $1 and status = 'active'", [branchId]))
}
