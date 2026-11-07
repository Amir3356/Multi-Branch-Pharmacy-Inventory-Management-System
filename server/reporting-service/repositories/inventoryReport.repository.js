import { query } from '../utils/index.js'

/* The Inventory Report's queries (stock_batches, products, branches and the movement tables, read only) */

export const branches = () => query('select id, name from branches')

/** Every batch, or one branch's when `byBranch` */
export const batches = (byBranch, branchId) =>
  byBranch ? query('select * from stock_batches where branch_id = $1', [branchId]) : query('select * from stock_batches')

export const productPrices = () => query('select id, name, purchase_price, selling_price from products')

// Units in and out of each branch during the period; each takes a { sql, values } condition from ReportPeriod
export const receivedByBranch = (received) =>
  query(`select branch_id as branch_id, sum(qty) as units from procurements where ${received.sql} group by branch_id`, received.values)

export const transferredInByBranch = (transferredIn) =>
  query(
    `select to_branch_id as branch_id, sum(qty) as units from stock_transfers where status = 'received' and ${transferredIn.sql} group by to_branch_id`,
    transferredIn.values,
  )

export const soldByBranch = (sold) => query(`select branch_id as branch_id, sum(qty) as units from sales where ${sold.sql} group by branch_id`, sold.values)

export const transferredOutByBranch = (transferredOut) =>
  query(`select from_branch_id as branch_id, sum(qty) as units from stock_transfers where ${transferredOut.sql} group by from_branch_id`, transferredOut.values)

export const damagedByBranch = (damaged) =>
  query(`select branch_id as branch_id, sum(qty) as units from damaged_items where ${damaged.sql} group by branch_id`, damaged.values)

export const correctedByBranch = (corrected) =>
  query(`select branch_id, sum(units_after - units_before) as units from stock_adjustments where ${corrected.sql} group by branch_id`, corrected.values)
