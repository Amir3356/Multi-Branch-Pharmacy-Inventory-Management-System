import { one, query } from '../utils/index.js'
import { STAGES } from '../models/procurementReport.model.js'

// Where each order stands: paid ones split into received (in stock) and still on the way
const STAGE = `case when procurements.status = 'paid' and procurements.received_at is not null then 'Received'
  when procurements.status = 'paid' then 'Paid, awaiting delivery'
  when procurements.status = 'pending' then 'Awaiting payment'
  else 'Payment failed' end`

/*
 * The Procurement Report's queries. `orders`/`values` is the period's condition on procurements (ReportPeriod.timestamps),
 * `localDay` the period's local-day expression for procurements.created_at.
 */
const paidOnly = (orders) => `${orders} and procurements.status = 'paid'`

export const totals = (orders, values) =>
  one(
    `select count(*) as orders,
        sum(total) filter (where status = 'paid') as spent,
        count(*) filter (where status = 'paid') as paid_orders,
        sum(qty) filter (where status = 'paid') as units_bought,
        count(*) filter (where status = 'pending') as awaiting_payment,
        sum(total) filter (where status = 'pending') as awaiting_payment_amount,
        count(*) filter (where status = 'paid' and received_at is null) as awaiting_delivery,
        count(*) filter (where status = 'failed') as failed,
        count(distinct supplier) as suppliers
       from procurements where ${orders}`,
    values,
  )

/** Orders and amount per stage, in STAGES order */
export const byStage = (orders, values) => {
  const next = `$${values.length + 1}`
  return Promise.all(
    STAGES.map((stage) =>
      one(`select count(*) as orders, coalesce(sum(total), 0) as amount from procurements where ${orders} and (${STAGE}) = ${next}`, [...values, stage]),
    ),
  )
}

export const daily = (orders, values, localDay) =>
  query(`select ${localDay} as day, sum(total) as spent, count(*) as orders from procurements where ${paidOnly(orders)} group by day order by day`, values)

export const bySupplier = (orders, values) =>
  query(
    `select supplier, count(*) as orders, sum(case when status = 'paid' then total else 0 end) as spent, sum(case when status = 'paid' then qty else 0 end) as units
       from procurements where ${orders} group by supplier order by "spent" desc`,
    values,
  )

export const byBranch = (orders, values) =>
  query(
    `select branches.name as branch, sum(procurements.total) as spent, count(*) as orders
       from procurements inner join branches on branches.id = procurements.branch_id where ${paidOnly(orders)} group by branches.name order by "spent" desc`,
    values,
  )

export const rows = (orders, values) =>
  query(
    `select procurements.id, procurements.created_at, branches.name as branch, procurements.supplier, procurements.product, procurements.category,
        procurements.qty, procurements.unit_price, procurements.total, procurements.status, procurements.received_at, procurements.batch,
        users.full_name as ordered_by, (${STAGE}) as stage
       from procurements left join branches on branches.id = procurements.branch_id left join users on users.id = procurements.created_by
       where ${orders} order by procurements.created_at desc limit 1000`,
    values,
  )
