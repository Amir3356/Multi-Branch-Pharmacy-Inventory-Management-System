import { nextId, one, query, transaction } from '../utils/index.js'

// Every database read and write for branches (Laravel's BranchRepository). Staff counts and history checks read other
// services' tables (users, procurements, stock_transfers, sales), read only.

const WITH_STAFF_COUNT = `select b.id, b.name, b.location, b.status,
    (select count(*) from users u where u.branch_id = b.id)::int as staff_count
  from branches b`

/** All branches with how many staff accounts each has, oldest first */
export const allWithStaffCount = () => query(`${WITH_STAFF_COUNT} order by b.id`)

export const findWithStaffCount = (id) => one(`${WITH_STAFF_COUNT} where b.id = $1`, [id])

export const find = (id) => one('select id, name, location, status from branches where id = $1', [id])

/** A new branch with the next free id (BR-01, BR-02, …), Active unless a status was given */
export function create({ name, location, status }) {
  return transaction(async (client) => {
    const id = await nextId(client, 'branches', 'BR', 2)
    return one(
      `insert into branches (id, name, location, status, created_at, updated_at) values ($1, $2, $3, $4, now(), now())
       returning id, name, location, status`,
      [id, name, location, status ?? 'active'],
      client,
    )
  })
}

const UPDATABLE = ['name', 'location', 'status']

/** Saves the fields that changed (Eloquent touched updated_at only when something changed) */
export async function update(branch, attributes) {
  const columns = UPDATABLE.filter((column) => attributes[column] !== undefined && attributes[column] !== branch[column])
  if (!columns.length) return
  const sets = columns.map((column, index) => `${column} = $${index + 2}`)
  await query(`update branches set ${sets.join(', ')}, updated_at = now() where id = $1`, [branch.id, ...columns.map((column) => attributes[column])])
}

export const remove = (id) => query('delete from branches where id = $1', [id])

export const hasStaff = async (id) => Boolean(await one('select 1 from users where branch_id = $1 limit 1', [id]))

/** Procurements, transfers or sales recorded for it: deleting the branch would break that history */
export async function hasHistory(id) {
  const row = await one(
    `select exists (select 1 from procurements where branch_id = $1)
         or exists (select 1 from stock_transfers where from_branch_id = $1 or to_branch_id = $1)
         or exists (select 1 from sales where branch_id = $1) as used`,
    [id],
  )
  return row.used
}

// PostgreSQL compares text case-sensitively, so "Bole Branch" and "bole branch" need an explicit check
export async function nameTaken(name, ignoreId = null) {
  return Boolean(await one('select 1 from branches where lower(name) = lower($1) and ($2::text is null or id <> $2) limit 1', [name, ignoreId]))
}
