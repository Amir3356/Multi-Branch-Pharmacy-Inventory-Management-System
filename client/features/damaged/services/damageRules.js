// Field errors for the Record Damaged Item form; empty when the write-off can be recorded
export function validateDamage(form, product, qty) {
  const errors = {}
  if (!form.category) errors.category = 'Select a category'
  if (!form.productName) errors.productName = form.category ? 'Select a product' : 'Select a category first'
  if (!form.batchKey) errors.batchKey = form.productName ? 'Select a batch number' : 'Select a product first'
  if (!Number.isInteger(qty) || qty < 1) errors.qty = 'Enter a whole number of at least 1'
  else if (product && qty > product.stock) errors.qty = `Only ${product.stock} units in stock in this batch`
  if (!form.reason) errors.reason = 'Select a reason'
  return errors
}
