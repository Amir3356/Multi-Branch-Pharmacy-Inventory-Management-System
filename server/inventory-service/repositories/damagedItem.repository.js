import { one, query } from '../utils/index.js'

const WITH_RECORDER = `select d.*, u.full_name as recorder_name from damaged_items d left join users u on u.id = d.recorded_by`

/** Newest first: every branch for those who cover all branches, otherwise the user's own branch */
export function visibleTo(user) {
  return user.coversAllBranches
    ? query(`${WITH_RECORDER} order by d.damage_date desc, d.id desc`)
    : query(`${WITH_RECORDER} where d.branch_id = $1 order by d.damage_date desc, d.id desc`, [user.branchId])
}

/** What one unit of the product cost to buy (its latest purchase price), or 0 when none was recorded */
export async function unitCost(medId) {
  if (!medId) return 0
  const row = await one('select purchase_price from products where id = $1', [medId])
  return Number(row?.purchase_price ?? 0)
}

export async function insert(client, id, attributes, now) {
  await client.query(
    `insert into damaged_items (id, branch_id, med_id, product, category, batch, qty, reason, loss_value, damage_date, recorded_by, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
    [
      id,
      attributes.branch_id,
      attributes.med_id,
      attributes.product,
      attributes.category,
      attributes.batch,
      attributes.qty,
      attributes.reason,
      attributes.loss_value,
      attributes.damage_date,
      attributes.recorded_by,
      now,
    ],
  )
}

/** A damaged item with its recorder's name */
export const withRecorder = (id, client) => one(`${WITH_RECORDER} where d.id = $1`, [id], client)
