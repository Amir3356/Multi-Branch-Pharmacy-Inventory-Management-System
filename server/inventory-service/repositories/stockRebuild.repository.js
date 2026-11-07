import { productKey, query } from '../utils/index.js'

/** The SQL of the stock rebuild (npm run rebuild-stock). Every function runs on the rebuild's transaction client. */

// Holds back every sale, transfer, damaged item and receipt until the new figures are saved
export async function lockStockBatches(client) {
  await client.query('lock table stock_batches in exclusive mode')
}

export async function deleteAllBatches(client) {
  await client.query('delete from stock_batches')
}

/** Inserts one chunk of rebuilt batches { branchId, product, category, medId, batch, expiry, receivedAt, stock } */
export async function insertBatches(client, chunk, now) {
  const params = []
  const values = chunk.map((b) => {
    params.push(b.branchId, b.product, productKey(b.product), b.category, b.medId, b.batch, b.expiry, b.receivedAt, Math.max(0, b.stock), now, now)
    const n = params.length - 11
    return `(${Array.from({ length: 11 }, (_, k) => `$${n + k + 1}`).join(', ')})`
  })
  await client.query(
    `insert into stock_batches (branch_id, product, product_key, category, med_id, batch, expiry_date, received_at, units, created_at, updated_at)
         values ${values.join(', ')}`,
    params,
  )
}

export const receivedProcurements = (client) =>
  query(
    `select branch_id as branch, product, category, med_id, coalesce(batch, id) as batch, expiry_date as expiry, received_at, qty
         from procurements where received_at is not null`,
    [],
    client,
  )

export const receivedTransfers = (client) =>
  query(
    `select to_branch_id as branch, product, category, med_id, coalesce(received_batch, batch) as batch, expiry_date as expiry, received_at, qty
         from stock_transfers where status = 'received'`,
    [],
    client,
  )

export const sentTransfers = (client) => query('select from_branch_id as branch, product, batch, qty, created_at from stock_transfers', [], client)

export const damagedItems = (client) => query('select branch_id as branch, product, batch, qty, created_at from damaged_items', [], client)

export const sales = (client) => query('select branch_id as branch, product, batches, qty, created_at from sales', [], client)

export const adjustments = (client) => query('select * from stock_adjustments', [], client)
