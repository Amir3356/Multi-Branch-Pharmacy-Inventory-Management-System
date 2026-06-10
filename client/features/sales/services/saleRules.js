// Field errors for the New Sale form; empty when the sale can be recorded
export function validateSale(form, product, qty, batchRow) {
  const errors = {}
  if (!form.branchId) errors.branchId = 'Select the branch making this sale'
  if (!form.category) errors.category = form.branchId ? 'Select a category' : 'Select a branch first'
  if (!product) errors.key = form.category ? 'Select a product' : 'Select a category first'
  // The batch is picked for the cashier (FEFO), so there is only an error when none can be sold
  if (product && !batchRow) errors.batch = 'No batch of this product can be sold (all expired or sold out)'
  if (!Number.isInteger(qty) || qty < 1) errors.qty = 'Enter a whole number of at least 1'
  // One sale comes from one batch (FEFO): up to what the batch expiring first holds; a new sale takes the next batch
  else if (batchRow && qty > batchRow.stock) errors.qty = `Only ${batchRow.stock} units left in batch ${batchRow.batch}, the one expiring first. Sell these, then the rest in a new sale from the next batch.`
  return errors
}
