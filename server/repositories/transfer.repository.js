import { one, query } from '../utils/index.js'

// A transfer with its sender's and receiver's names (TransferResource's sender / receiver relations)
const WITH_PEOPLE = `select t.*, s.full_name as sender_name, r.full_name as receiver_name
  from stock_transfers t
  left join users s on s.id = t.sent_by
  left join users r on r.id = t.received_by`

/** Newest first: every branch for those who cover all branches, otherwise what the user's branch sent or received */
export function visibleTo(user) {
  return user.coversAllBranches
    ? query(`${WITH_PEOPLE} order by t.created_at desc`)
    : query(`${WITH_PEOPLE} where t.from_branch_id = $1 or t.to_branch_id = $1 order by t.created_at desc`, [user.branchId])
}

export const findTransfer = (id) => one('select * from stock_transfers where id = $1', [id])

export const withPeople = (id, client) => one(`${WITH_PEOPLE} where t.id = $1`, [id], client)

export const lockForUpdate = (id, client) => one('select * from stock_transfers where id = $1 for update', [id], client)

export async function insert(client, id, attributes, expiry, now) {
  await client.query(
    `insert into stock_transfers (id, from_branch_id, to_branch_id, category, product, med_id, batch, expiry_date, qty, status, sent_by, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
    [
      id,
      attributes.from_branch_id,
      attributes.to_branch_id,
      attributes.category,
      attributes.product,
      attributes.med_id,
      attributes.batch,
      expiry,
      attributes.qty,
      attributes.status,
      attributes.sent_by,
      now,
    ],
  )
}

export async function setReceived(client, id, byUserId, receivedAt, receivedBatch) {
  await client.query(
    `update stock_transfers set status = 'received', received_by = $2, received_at = $3, received_batch = $4, updated_at = $3 where id = $1`,
    [id, byUserId, receivedAt, receivedBatch],
  )
}
