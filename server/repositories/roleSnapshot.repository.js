import { query } from '../utils/index.js'

/*
 * The base data of the Owner's AI snapshot: branches, product costs and stock (read only). The period's figures come
 * from the dashboard summary and ownerInsights.repository.js.
 */

export const branches = () => query('select id, name, status from branches order by name')

export const productCosts = () => query('select name, purchase_price from products where purchase_price is not null')

export const stockBatches = () => query('select * from stock_batches')
