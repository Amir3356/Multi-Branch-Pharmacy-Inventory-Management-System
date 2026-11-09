import { iso8601 } from '../utils/time.js'

/** products: the shared catalog. Prices are the same at every branch, null until first set. */
export const TABLE = 'products'

/** ProductResource: prices as numbers ((float) casts), null until first set */
export const toResource = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  // The newest Batch ID, generated when the Purchase Officer saved it (Category & Product page)
  batch: p.batch ?? null,
  // Every Batch ID the product has, oldest first ({ batch, createdAt }); procurements buy under one of them and the
  // Inventory Officer receives the stock under the same one. Only the catalog listing loads them (else []).
  // A batch is bought once: procurementId is the paid order that bought it (null while it can still be bought)
  batches: (p.batches ?? []).map((b) => ({ batch: b.batch, createdAt: iso8601(b.created_at), procurementId: b.procurement_id ?? null })),
  purchasePrice: p.purchase_price === null || p.purchase_price === undefined ? null : Number(p.purchase_price),
  sellingPrice: p.selling_price === null || p.selling_price === undefined ? null : Number(p.selling_price),
})
