import { one, pool, query } from '../utils/index.js'
import { nowSeconds } from '../utils/support.js'

/** The whole catalog, by category then name */
export const allProducts = () => query('select * from products order by category, name')

export const findProduct = (id, client) => one('select * from products where id = $1', [id], client)

/**
 * Sets the shared prices of a product (either may be null: left as is) and who set them; returns the product row, or
 * null when it isn't in the catalog. Postgres rounds to 2 decimals on save, as PHP's round($x, 2) did.
 * Like Eloquent's update(), nothing is written (updated_at kept) when the values are already the same.
 */
export async function setPrices(client, id, purchasePrice, sellingPrice, byUserId) {
  if (!id) return null
  const purchase = purchasePrice === null || purchasePrice === undefined ? null : String(purchasePrice)
  const selling = sellingPrice === null || sellingPrice === undefined ? null : String(sellingPrice)
  const by = byUserId ?? null

  const updated = await one(
    `update products set
       purchase_price = coalesce($2::numeric(12, 2), purchase_price),
       selling_price = coalesce($3::numeric(12, 2), selling_price),
       price_set_by = $4,
       updated_at = $5
     where id = $1
       and (purchase_price is distinct from coalesce($2::numeric(12, 2), purchase_price)
         or selling_price is distinct from coalesce($3::numeric(12, 2), selling_price)
         or price_set_by is distinct from $4::bigint)
     returning *`,
    [id, purchase, selling, by, nowSeconds()],
    client,
  )
  return updated ?? findProduct(id, client)
}

/** Another product in this category with the same name, ignoring case (optionally not the one being edited) */
export const findSameName = (category, name, exceptId = null) =>
  one('select * from products where category = $1 and lower(name) = lower($2) and id is distinct from $3', [category, name, exceptId])

/** A new catalog product with its first Batch ID, without prices (they are set when stock is received). Call in a transaction. */
export function createProduct(client, { id, name, category, batch }) {
  const now = nowSeconds()
  return one(
    'insert into products (id, name, category, batch, created_at, updated_at) values ($1, $2, $3, $4, $5, $5) returning *',
    [id, name, category, batch, now],
    client,
  )
}

// The paid order that bought the batch (a batch is bought once), or null while it is still free to buy
const PAID_ORDER = "(select po.id from procurements po where po.batch = pb.batch and po.status = 'paid' order by po.created_at limit 1) as procurement_id"

/** Every product's Batch IDs, oldest first: { batch, product_id, created_at, procurement_id } */
export const allBatches = () => query(`select pb.batch, pb.product_id, pb.created_at, ${PAID_ORDER} from product_batches pb order by pb.created_at, pb.batch`)

/** The Batch IDs of one product, oldest first */
export const batchesOf = (productId, client = pool) =>
  query(`select pb.batch, pb.product_id, pb.created_at, ${PAID_ORDER} from product_batches pb where pb.product_id = $1 order by pb.created_at, pb.batch`, [productId], client)

/** The batch row, only when it belongs to this product */
export const findProductBatch = (productId, batch, client = pool) =>
  one('select * from product_batches where product_id = $1 and batch = $2', [productId, batch], client)

/** The paid order already bought under this Batch ID, or null */
export const findPaidOrderForBatch = (batch, client = pool) =>
  one("select id from procurements where batch = $1 and status = 'paid' limit 1", [batch], client)

/** Records a new Batch ID for a product and makes it the product's newest. Call in a transaction. Returns the products row. */
export async function addBatch(client, productId, batch, byUserId) {
  const now = nowSeconds()
  await client.query('insert into product_batches (batch, product_id, created_by, created_at) values ($1, $2, $3, $4)', [batch, productId, byUserId ?? null, now])
  return one('update products set batch = $2, updated_at = $3 where id = $1 returning *', [productId, batch, now], client)
}

export const updateProduct = (id, { name, category }) =>
  one('update products set name = $2, category = $3, updated_at = $4 where id = $1 returning *', [id, name, category, nowSeconds()])

export const deleteProduct = (id) => one('delete from products where id = $1 returning *', [id])

/** Any stock batch (any branch, even used up) refers to this product: its name and category are then fixed */
export async function hasStock(id, client = pool) {
  return Boolean(await one('select 1 from stock_batches where med_id = $1 limit 1', [id], client))
}

/** How many catalog products are filed under this category (procurement-service asks before renaming or deleting one) */
export async function countInCategory(category) {
  const row = await one('select count(*)::int as count from products where lower(category) = lower($1)', [category])
  return row.count
}
