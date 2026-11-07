// Field errors for the New Purchase form; staff tied to a branch can only buy for it while it is Active
export function validatePurchase(form, { product, qty, totalCost, assignedBranchId, assignedBranch }) {
  const errors = {}
  if (assignedBranchId && assignedBranch?.status !== 'Active') errors.branchId = 'Your assigned branch is inactive. Ask the Owner to activate it or assign you another one.'
  else if (!form.branchId) errors.branchId = 'Select the branch receiving the stock'
  if (!form.supplier.trim()) errors.supplier = 'Supplier is required'
  if (!form.category) errors.category = 'Select a category'
  if (!product) errors.medId = form.category ? 'Select a product' : 'Select a category first'
  if (!Number.isInteger(qty) || qty < 1) errors.qty = 'Enter a whole number of at least 1'
  if (form.totalCost === '' || Number.isNaN(totalCost) || totalCost <= 0) errors.totalCost = 'Enter a total cost greater than 0'
  return errors
}
