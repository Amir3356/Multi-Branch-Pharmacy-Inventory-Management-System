import { config, one, query } from '../utils/index.js'
import { Params, sqlString } from '../utils/php.js'

/**
 * A copy of reporting-service's ownerDashboard queries: the Owner's AI snapshot uses the same figures as the dashboard.
 * The Owner's dashboard queries for a period (calendar days in the store's time zone) and optionally one branch.
 * Sales count by when they were made, purchases by order date (paid orders only, as on the Purchase Officer's
 * dashboard), expenses by their expense date, damaged stock by the day it was written off.
 * Reads sales, procurements, expenses, damaged_items, products, branches and users (owned by other services).
 */

/**
 * Sales joined to their catalog product, for its purchase price: by the sale's product id when the catalog has it,
 * otherwise by name and category (a sale without an id, or with one only a browser knew, still finds its cost).
 */
export const WITH_PRODUCT = `left join products on products.id = sales.med_id or (lower(products.name) = lower(sales.product)
  and products.category = sales.category and not exists (select 1 from products known where known.id = sales.med_id))`

const localDay = (column) => `to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${sqlString(config.timezone)}, 'YYYY-MM-DD')`

/** The { sql, values } conditions for the period's sales, paid purchases, expenses and damaged stock */
export function periodConditions(start, end, from, to, branchId, byBranch) {
  const scope = (column, low, high, branchColumn, extra = '') => {
    const p = new Params()
    let sql = `${column} between ${p.add(low)} and ${p.add(high)}${extra}`
    if (byBranch) sql += ` and ${branchColumn} = ${p.add(branchId)}`
    return { sql, values: p.values }
  }
  const sales = scope('sales.created_at', start, end, 'sales.branch_id')
  const purchases = scope('created_at', start, end, 'branch_id', " and status = 'paid'")
  const expenses = scope('expense_date', from, to, 'branch_id')
  const damaged = scope('damage_date', from, to, 'branch_id')
  return { sales, purchases, expenses, damaged }
}

// Cost of what was sold: units × the product's purchase price (its latest, the one Receive Stock recorded)
export const costOfSales = (sales) =>
  one(`select sum(sales.qty * coalesce(products.purchase_price, 0)) as cost from sales ${WITH_PRODUCT} where ${sales.sql}`, sales.values)

export const salesTotals = (sales) => one(`select sum(total) as total, count(*) as count, sum(qty) as qty from sales where ${sales.sql}`, sales.values)

export const purchaseTotals = (purchases) => one(`select sum(total) as total, count(*) as count from procurements where ${purchases.sql}`, purchases.values)

export const expenseTotals = (expenses) => one(`select sum(amount) as total, count(*) as count from expenses where ${expenses.sql}`, expenses.values)

export const damageTotals = (damaged) => one(`select sum(loss_value) as total, sum(qty) as qty from damaged_items where ${damaged.sql}`, damaged.values)

export const topProducts = (sales) =>
  query(`select product, sum(total) as total, sum(qty) as qty from sales where ${sales.sql} group by product order by total desc limit 20`, sales.values)

// Sales, purchases and expenses per day of the period
export const dailySales = (sales) =>
  query(`select ${localDay('created_at')} as day, sum(total) as amount from sales where ${sales.sql} group by day`, sales.values)

export const dailyPurchases = (purchases) =>
  query(`select ${localDay('created_at')} as day, sum(total) as amount from procurements where ${purchases.sql} group by day`, purchases.values)

export const dailyExpenses = (expenses) =>
  query(`select to_char(expense_date, 'YYYY-MM-DD') as day, sum(amount) as amount from expenses where ${expenses.sql} group by day`, expenses.values)

// Every branch's figures for the period (the branch filter doesn't apply here)
export const salesByBranch = (start, end) =>
  query(
    `select sales.branch_id, sum(sales.total) as total, count(*) as count, sum(sales.qty * coalesce(products.purchase_price, 0)) as cost
       from sales ${WITH_PRODUCT} where sales.created_at between $1 and $2 group by sales.branch_id`,
    [start, end],
  )

export const purchasesByBranch = (start, end) =>
  query(`select branch_id, sum(total) as total from procurements where created_at between $1 and $2 and status = 'paid' group by branch_id`, [start, end])

export const expensesByBranch = (from, to) =>
  query('select branch_id, sum(amount) as total from expenses where expense_date between $1 and $2 group by branch_id', [from, to])

export const damageByBranch = (from, to) =>
  query('select branch_id, sum(loss_value) as total from damaged_items where damage_date between $1 and $2 group by branch_id', [from, to])

export const branchesByName = () => query('select id, name, status from branches order by name')

// Figures that don't depend on the period
export const branchCounts = () => one("select count(*) filter (where status = 'active') as active, count(*) as total from branches")

export const activeStaffCount = (byBranch, branchId) =>
  byBranch
    ? one("select count(*) as count from users where role != 'owner' and status = 'active' and (branch_id = $1 or branch_id is null)", [branchId])
    : one("select count(*) as count from users where role != 'owner' and status = 'active'")

export const invitedStaffCount = (byBranch, branchId) =>
  byBranch
    ? one("select count(*) as count from users where status = 'invited' and branch_id = $1", [branchId])
    : one("select count(*) as count from users where status = 'invited'")

export const pendingOrders = (byBranch, branchId) =>
  byBranch
    ? one("select count(*) as count, sum(total) as total from procurements where status = 'pending' and branch_id = $1", [branchId])
    : one("select count(*) as count, sum(total) as total from procurements where status = 'pending'")
