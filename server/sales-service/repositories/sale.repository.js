import { one, pool, productKey, query } from '../utils/index.js'

// Every database read and write for sales. Rows carry seller_name (the seller's full name) for the model's resource shape.
const SELECT = 'select s.*, u.full_name as seller_name from sales s left join users u on u.id = s.sold_by'

/** Newest first: every branch for those who cover all branches, otherwise the user's own branch */
export function visibleTo(user) {
  return user.coversAllBranches
    ? query(`${SELECT} order by s.created_at desc`)
    : query(`${SELECT} where s.branch_id = $1 order by s.created_at desc`, [user.branchId])
}

/** The sale this cashier already recorded with this idempotency key, if any */
export function findByIdempotencyKey(userId, key, client = pool) {
  return one(`${SELECT} where s.sold_by = $1 and s.idempotency_key = $2`, [userId, key], client)
}

export function insert(client, sale) {
  return one(
    `insert into sales (id, branch_id, customer, category, product, med_id, qty, batches, unit_price, total, status, sold_by, idempotency_key, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
     returning *`,
    [
      sale.id,
      sale.branch_id,
      sale.customer,
      sale.category,
      sale.product,
      sale.med_id,
      sale.qty,
      JSON.stringify(sale.batches),
      sale.unit_price.toFixed(2),
      sale.total.toFixed(2),
      sale.status,
      sale.sold_by,
      sale.idempotency_key,
      sale.created_at,
    ],
    client,
  )
}

/**
 * { batch: 'YYYY-MM-DD' | null } for the given batches of a product at a branch (stock_batches is inventory-service's
 * table; reading it here is allowed). Missing batches are absent from the result.
 */
export async function batchExpiries(branchId, product, batches) {
  const rows = await query(
    'select batch, expiry_date from stock_batches where branch_id = $1 and product_key = $2 and batch = any($3::text[])',
    [branchId, productKey(product), batches],
  )
  return Object.fromEntries(rows.map((row) => [row.batch, row.expiry_date]))
}

/** Whether the branch exists and is active (branches belong to branch-service; reading them is allowed) */
export async function activeBranchExists(branchId) {
  return Boolean(await one("select 1 from branches where id = $1 and status = 'active'", [branchId]))
}
