import { one, query } from '../utils/index.js'

/* The forecaster's queries: sales history, stock and open orders at every branch (other services' tables, read only) */

export const firstSale = () => one('select min(created_at) as first from sales')

export const branches = () => query('select id, name from branches')

export const productCosts = () => query('select name, purchase_price from products')

/** Units sold per branch and product since a UTC time */
export const unitsSoldSince = (since) =>
  query(
    `select branch_id, lower(trim(product)) as product_key, max(product) as product, sum(qty) as units
       from sales where created_at >= $1 group by branch_id, product_key`,
    [since],
  )

export const batchesInStock = () => query('select * from stock_batches where units > 0')

/** Units per branch and product on orders still to arrive (awaiting payment, or paid and not received) */
export const unitsOnOrder = () =>
  query(
    `select branch_id, lower(trim(product)) as product_key, sum(qty) as units from procurements
       where (status = 'pending' or (status = 'paid' and received_at is null)) group by branch_id, product_key`,
  )

export const revenueByBranchSince = (since) => query('select branch_id, sum(total) as total from sales where created_at >= $1 group by branch_id', [since])

export const revenueBetween = (from, to) => one('select sum(total) as total from sales where created_at between $1 and $2', [from, to])
