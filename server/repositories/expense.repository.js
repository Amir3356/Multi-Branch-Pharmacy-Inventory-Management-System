import { one, query } from '../utils/index.js'

// Every database read and write for expenses. Rows carry recorder_name for the model's resource shape.
const SELECT = 'select e.*, u.full_name as recorder_name from expenses e left join users u on u.id = e.recorded_by'

/** Newest first: every branch for those who cover all branches, otherwise the user's own branch */
export function visibleTo(user) {
  const order = 'order by e.expense_date desc, e.id desc'
  return user.coversAllBranches
    ? query(`${SELECT} ${order}`)
    : query(`${SELECT} where e.branch_id = $1 ${order}`, [user.branchId])
}

export function find(id) {
  return one(`${SELECT} where e.id = $1`, [id])
}

export function insert(client, expense) {
  return one(
    `insert into expenses (id, branch_id, category, description, amount, expense_date, recorded_by, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     returning *`,
    [expense.id, expense.branch_id, expense.category, expense.description, expense.amount.toFixed(2), expense.expense_date, expense.recorded_by, expense.created_at],
    client,
  )
}

export async function remove(id) {
  await query('delete from expenses where id = $1', [id])
}
