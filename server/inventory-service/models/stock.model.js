import { iso8601, productKey } from '../utils/index.js'

/** stock_batches: one row per branch, product (product_key) and batch, holding its units. Changed only by this service. */
export const TABLE = 'stock_batches'

/**
 * StockRepository::present(): batches as the app's stock rows. The catalog id comes from the batch, or else the
 * catalog entry with the same name (preferring the same category), since an order for a product new to the catalog
 * carries no id. `catalog` is every products row { id, name, category }.
 */
export function toResources(batches, catalog) {
  const byKey = new Map()
  for (const p of catalog) {
    const key = productKey(p.name)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(p)
  }

  return batches.map((b) => {
    const matches = byKey.get(b.product_key) ?? []
    const medId = b.med_id ?? (matches.find((p) => p.category === b.category) ?? matches[0])?.id ?? null
    return {
      id: b.id,
      branchId: b.branch_id,
      medId,
      product: b.product,
      category: b.category,
      batch: b.batch,
      expiry: b.expiry_date ?? null,
      stock: b.units,
      receivedAt: iso8601(b.received_at),
    }
  })
}
