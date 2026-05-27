/** products: the shared catalog. Prices are the same at every branch, null until first set. */
export const TABLE = 'products'

/** ProductResource: prices as numbers ((float) casts), null until first set */
export const toResource = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  // Set when the Purchase Officer saved it; its stock is received under this batch
  batch: p.batch ?? null,
  purchasePrice: p.purchase_price === null || p.purchase_price === undefined ? null : Number(p.purchase_price),
  sellingPrice: p.selling_price === null || p.selling_price === undefined ? null : Number(p.selling_price),
})
