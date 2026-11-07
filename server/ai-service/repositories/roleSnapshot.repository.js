import { query } from '../utils/index.js'
import { truthy } from '../utils/php.js'
import { LIST_LIMIT } from '../models/roleSnapshot.model.js'

/*
 * The role snapshot's queries: stock, sales, procurements, transfers, expenses and damaged items (other services'
 * tables, read only).
 */

export const branches = () => query('select id, name, status from branches order by name')

export const productCosts = () => query('select name, purchase_price from products where purchase_price is not null')

export const stockBatches = () => query('select * from stock_batches')

/** A branch's paid orders not yet received, oldest payment first */
export const paidAwaitingReceiving = (branchId) =>
  query(
    `select product, qty, paid_at from procurements where branch_id = $1 and status = 'paid' and received_at is null order by paid_at asc limit ${LIST_LIMIT}`,
    [branchId],
  )

/** A branch's sales totals since `from`, or between `from` and `to` */
export const salesTotals = (branchId, from, to = null) => {
  const [condition, params] = to === null ? ['created_at >= $2', [from]] : ['created_at between $2 and $3', [from, to]]
  return query(`select sum(total) as amount, count(*) as count, sum(qty) as units from sales where branch_id = $1 and ${condition}`, [branchId, ...params])
}

/** A branch's sales per local hour of the day since a UTC time */
export const salesByHour = (zone, branchId, since) =>
  query(
    `select extract(hour from (created_at AT TIME ZONE 'UTC') AT TIME ZONE $1)::int as hour, count(*) as count, sum(total) as amount
       from sales where branch_id = $2 and created_at >= $3 group by hour order by hour asc`,
    [zone, branchId, since],
  )

export const ordersAwaitingPayment = () =>
  query(
    `select branch_id, supplier, product, qty, total, status, created_at from procurements where status in ('pending', 'failed') order by created_at desc limit ${LIST_LIMIT}`,
  )

export const paidNotReceived = () =>
  query(`select branch_id, supplier, product, qty, paid_at from procurements where status = 'paid' and received_at is null order by paid_at asc limit ${LIST_LIMIT}`)

export const supplierPrices = (since) =>
  query(
    `select product, supplier, round(avg(unit_price), 2) as avg_price, min(unit_price) as best_price, count(*) as orders, max(created_at) as last_order
       from procurements where status = 'paid' and created_at >= $1 group by product, supplier order by product asc limit 40`,
    [since],
  )

export const paidSpendSince = (recent) => query("select sum(total) as paid, count(*) as orders from procurements where status = 'paid' and created_at >= $1", [recent])

/** Units of a product (by lower-case name) on orders for a branch that haven't arrived */
export const unitsOnOrder = (branchId, key) =>
  query(
    `select sum(qty) as units from procurements where branch_id = $1 and lower(product) = $2
       and (status = 'pending' or (status = 'paid' and received_at is null))`,
    [branchId, key],
  )

/** Transfers in transit to or from a branch: `column` is 'to_branch_id' or 'from_branch_id' */
export const transfersInTransit = (column, branchId) =>
  query(
    `select from_branch_id, to_branch_id, product, qty, created_at from stock_transfers where ${column} = $1 and status = 'in_transit' order by created_at asc limit ${LIST_LIMIT}`,
    [branchId],
  )

/** Units and revenue per product (keyed by lower-case name) at a branch since a UTC time */
export const salesVelocity = (branchId, since) =>
  query(
    `select lower(trim(product)) as key, max(product) as product, sum(qty) as units, sum(total) as revenue
       from sales where branch_id = $1 and created_at >= $2 group by key`,
    [branchId, since],
  )

/** Damaged stock per reason since a date, at one branch or (branchId empty) every branch */
export const damageByReason = (fromDate, branchId) => {
  const p = [fromDate]
  if (truthy(branchId)) p.push(branchId)
  return query(
    `select reason, sum(qty) as units, sum(loss_value) as loss, count(*) as records from damaged_items
     where damage_date >= $1${truthy(branchId) ? ' and branch_id = $2' : ''} group by reason order by "loss" desc`,
    p,
  )
}

/** Expenses per category since a date, at one branch or (branchId empty) every branch */
export const expensesByCategory = (fromDate, branchId) => {
  const p = [fromDate]
  if (truthy(branchId)) p.push(branchId)
  return query(
    `select category, sum(amount) as amount, count(*) as records from expenses
     where expense_date >= $1${truthy(branchId) ? ' and branch_id = $2' : ''} group by category order by "amount" desc`,
    p,
  )
}
