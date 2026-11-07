import { one, query } from '../utils/index.js'
import { WITH_PRODUCT } from './ownerDashboard.repository.js'

/*
 * The Sales Report's queries. `where`/`values` is the period's condition on sales (ReportPeriod.timestamps), `localDay`
 * the period's local-day expression for sales.created_at.
 */
const TOP = 15

const PEOPLE = 'left join users on users.id = sales.sold_by left join branches on branches.id = sales.branch_id'

export const totals = (where, values) => one(`select sum(total) as revenue, count(*) as count, sum(qty) as units from sales where ${where}`, values)

// Cost of what was sold: units × the product's purchase price, found as the Owner's dashboard finds it
export const costOfSales = (where, values) =>
  one(`select sum(sales.qty * coalesce(products.purchase_price, 0)) as cost from sales ${WITH_PRODUCT} where ${where}`, values)

export const daily = (where, values, localDay) =>
  query(`select ${localDay} as day, sum(total) as revenue, count(*) as transactions from sales where ${where} group by day order by day`, values)

export const byBranch = (where, values) =>
  query(
    `select branches.name as branch, sum(total) as revenue, count(*) as transactions, sum(qty) as units
       from sales inner join branches on branches.id = sales.branch_id where ${where} group by branches.name order by "revenue" desc`,
    values,
  )

export const byCategory = (where, values) =>
  query(`select category, sum(total) as revenue, sum(qty) as units from sales where ${where} group by category order by "revenue" desc`, values)

export const topProducts = (where, values) =>
  query(
    `select product, max(category) as category, sum(qty) as units, sum(total) as revenue, count(*) as transactions
       from sales where ${where} group by product order by "revenue" desc limit ${TOP}`,
    values,
  )

export const byCashier = (where, values) =>
  query(
    `select coalesce(users.full_name, 'Former staff') as cashier, max(branches.name) as branch, count(*) as transactions, sum(sales.total) as revenue, sum(sales.qty) as units
       from sales ${PEOPLE} where ${where} group by "cashier" order by "revenue" desc`,
    values,
  )

export const rows = (where, values) =>
  query(
    `select sales.id, sales.created_at, branches.name as branch, users.full_name as cashier, sales.customer, sales.product, sales.category, sales.qty, sales.unit_price, sales.total
       from sales ${PEOPLE} where ${where} order by sales.created_at desc limit 1000`,
    values,
  )
