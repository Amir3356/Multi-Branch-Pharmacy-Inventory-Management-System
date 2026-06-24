import { one, query } from '../utils/index.js'
import { truthy } from '../utils/helpers.js'

/*
 * Read-only queries for the Owner's AI business advisor. Every query takes the period as UTC timestamps (start, end)
 * for timestamp columns, or local dates (from, to) for date columns, and an optional branch: empty = every branch.
 */

/** " and <column> = $n" for a branch, pushing its value onto params; '' for every branch */
function branchClause(column, branchId, params) {
  if (!truthy(branchId)) return ''
  params.push(branchId)
  return ` and ${column} = $${params.length}`
}

// ---- Money ----

export function expensesByCategory(from, to, branchId) {
  const p = [from, to]
  return query(
    `select category, sum(amount) as amount, count(*) as records from expenses
      where expense_date between $1 and $2${branchClause('branch_id', branchId, p)}
      group by category order by amount desc`,
    p,
  )
}

export function damageByReason(from, to, branchId) {
  const p = [from, to]
  return query(
    `select reason, sum(qty) as units, sum(loss_value) as loss, count(*) as records from damaged_items
      where damage_date between $1 and $2${branchClause('branch_id', branchId, p)}
      group by reason order by loss desc`,
    p,
  )
}

/** Units and revenue per product in the period, keyed by lower-case name */
export function productSales(start, end, branchId) {
  const p = [start, end]
  return query(
    `select branch_id, lower(trim(product)) as key, max(product) as product, sum(qty) as units, sum(total) as revenue
       from sales where created_at between $1 and $2${branchClause('branch_id', branchId, p)}
       group by branch_id, key`,
    p,
  )
}

// ---- Purchasing ----

/** Paid orders per supplier in the period */
export function suppliers(start, end, branchId) {
  const p = [start, end]
  return query(
    `select supplier, count(*) as orders, sum(qty) as units, sum(total) as spent, count(distinct lower(trim(product))) as products
       from procurements where status = 'paid' and created_at between $1 and $2${branchClause('branch_id', branchId, p)}
       group by supplier order by spent desc limit 15`,
    p,
  )
}

/** Average unit price per product and supplier since a time: the same product bought for different prices */
export function supplierPrices(since, branchId) {
  const p = [since]
  return query(
    `select lower(trim(product)) as key, max(product) as product, supplier, round(avg(unit_price), 2) as unit_price, sum(qty) as units
       from procurements where status = 'paid' and created_at >= $1${branchClause('branch_id', branchId, p)}
       group by key, supplier`,
    p,
  )
}

/** Paid orders not yet added to stock: how many, what they cost, and the oldest */
export function awaitingDelivery(branchId) {
  const p = []
  return one(
    `select count(*) as orders, coalesce(sum(total), 0) as value, min(created_at) as oldest
       from procurements where status = 'paid' and received_at is null${branchClause('branch_id', branchId, p)}`,
    p,
  )
}

/** Stock moved between branches in the period: per route, units sent and how many are still in transit */
export function transfers(start, end, branchId) {
  const p = [start, end]
  let clause = ''
  if (truthy(branchId)) {
    p.push(branchId)
    clause = ` and (from_branch_id = $3 or to_branch_id = $3)`
  }
  return query(
    `select from_branch_id, to_branch_id, count(*) as transfers, sum(qty) as units,
            count(*) filter (where status = 'in_transit') as in_transit
       from stock_transfers where created_at between $1 and $2${clause}
       group by from_branch_id, to_branch_id order by units desc limit 15`,
    p,
  )
}

// ---- Audit trail ----

// Records that change the business figures: their deletions and after-hours changes are worth the Owner's review
const BUSINESS_MODULES = `('Sales', 'Expenses', 'Procurement', 'Damaged Items', 'Inventory', 'Products', 'Stock Transfers', 'Branches', 'Policy')`
// The Owner reviews staff: their own actions are never flagged
const NOT_OWNER = `coalesce(user_role, '') <> 'Owner'`

/** Recorded actions per module and type in the period */
export function auditCounts(start, end, branchId) {
  const p = [start, end]
  return query(
    `select module, action_type, count(*) as count from audit_logs
      where occurred_at between $1 and $2${branchClause('branch_id', branchId, p)}
      group by module, action_type`,
    p,
  )
}

/** Staff deletions of business records in the period, newest first */
export function deletions(start, end, branchId) {
  const p = [start, end]
  return query(
    `select occurred_at, user_id, user_role, branch_name, module, action, description from audit_logs
      where action_type = 'delete' and module in ${BUSINESS_MODULES} and ${NOT_OWNER}
        and occurred_at between $1 and $2${branchClause('branch_id', branchId, p)}
      order by occurred_at desc limit 20`,
    p,
  )
}

/** Failed or blocked sign-ins per local day (sign-ins belong to no branch) */
export function failedSignIns(start, end, zone) {
  return query(
    `select ((occurred_at at time zone 'UTC') at time zone $3)::date::text as day, count(*) as attempts,
            count(distinct coalesce(ip_address, '')) as addresses
       from audit_logs where module = 'Sign-in' and action_type = 'reject' and occurred_at between $1 and $2
       group by day order by attempts desc limit 10`,
    [start, end, zone],
  )
}

/**
 * Staff changes to business records outside opening hours (store time), one row per person and local day: how many,
 * which modules, and the first and last time
 */
export function afterHoursChanges(start, end, branchId, zone, openHour, closeHour) {
  const p = [start, end, zone, openHour, closeHour]
  return query(
    `select user_id, max(user_role) as user_role, max(branch_name) as branch_name,
            ((occurred_at at time zone 'UTC') at time zone $3)::date::text as day, count(*) as changes,
            string_agg(distinct module, ', ') as modules, min(occurred_at) as first_at, max(occurred_at) as last_at
       from audit_logs
      where action_type in ('create', 'update', 'delete', 'approve') and module in ${BUSINESS_MODULES} and ${NOT_OWNER}
        and occurred_at between $1 and $2
        and (extract(hour from (occurred_at at time zone 'UTC') at time zone $3) < $4
          or extract(hour from (occurred_at at time zone 'UTC') at time zone $3) >= $5)${branchClause('branch_id', branchId, p)}
      group by user_id, day order by changes desc limit 10`,
    p,
  )
}

/** Stock count corrections in the period, the biggest changes first, with who made them */
export function stockCorrections(start, end, branchId) {
  const p = [start, end]
  return query(
    `select a.branch_id, a.product, a.batch, a.units_before, a.units_after, a.expiry_before, a.expiry_after, a.created_at,
            a.adjusted_by, u.role as adjusted_by_role
       from stock_adjustments a left join users u on u.id = a.adjusted_by
      where a.created_at between $1 and $2${branchClause('a.branch_id', branchId, p)}
      order by abs(a.units_after - a.units_before) desc limit 40`,
    p,
  )
}

/** Per person: how many changes, deletions and corrections they recorded in the period */
export function activityByUser(start, end, branchId) {
  const p = [start, end]
  return query(
    `select user_id, max(user_role) as user_role, count(*) as actions,
            count(*) filter (where action_type = 'delete') as deletions,
            count(*) filter (where action ilike '%corrected%') as corrections,
            count(*) filter (where action_type in ('create', 'update', 'delete', 'approve')) as changes
       from audit_logs
      where user_id is not null and occurred_at between $1 and $2${branchClause('branch_id', branchId, p)}
      group by user_id order by changes desc limit 15`,
    p,
  )
}

/** Sales or expenses far above the period's usual size (more than `times` the average) */
export function largeSales(start, end, branchId, times) {
  const p = [start, end]
  const branch = branchClause('branch_id', branchId, p)
  p.push(times)
  return query(
    `with s as (select * from sales where created_at between $1 and $2${branch})
     select id, branch_id, product, qty, total, created_at, sold_by, (select avg(total) from s) as average
       from s where total > $${p.length} * (select avg(total) from s) and (select count(*) from s) >= 5
      order by total desc limit 10`,
    p,
  )
}

/** Expenses from `historyFrom` to the period's end: the period's own, and the history they are judged against */
export function expensesSince(historyFrom, to, branchId) {
  const p = [historyFrom, to]
  return query(
    `select id, branch_id, category, amount, expense_date::text as expense_date, recorded_by from expenses
      where expense_date between $1 and $2${branchClause('branch_id', branchId, p)} order by expense_date`,
    p,
  )
}

/** Selling-price changes recorded in the period */
export function priceChanges(start, end) {
  return query(
    `select occurred_at, user_id, user_role, description from audit_logs
      where module = 'Products' and action ilike '%price%' and ${NOT_OWNER} and occurred_at between $1 and $2
      order by occurred_at desc limit 15`,
    [start, end],
  )
}
