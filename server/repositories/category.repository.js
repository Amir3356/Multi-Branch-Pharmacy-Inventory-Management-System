import { one, query } from '../utils/index.js'
import { nowSeconds } from '../utils/time.js'

// Every database read and write for procurement categories

/** A to Z, ignoring case */
export const all = () => query('select * from procurement_categories order by lower(name)')

export const find = (id) => one('select * from procurement_categories where id = $1', [id])

/** The category with this name, ignoring case (used to check Create Procurement's choice) */
export const findByName = (name) => one('select * from procurement_categories where lower(name) = lower($1)', [name])

export function create(name, createdBy) {
  const now = nowSeconds()
  return one(
    'insert into procurement_categories (name, created_by, created_at, updated_at) values ($1, $2, $3, $3) returning *',
    [name, createdBy, now],
  )
}

export const rename = (id, name) =>
  one('update procurement_categories set name = $2, updated_at = $3 where id = $1 returning *', [id, name, nowSeconds()])

export const remove = (id) => one('delete from procurement_categories where id = $1 returning *', [id])
