import { coversAllBranches } from '../model/account'

// Field errors for the Add/Edit Account form; empty when it can be saved. `email` is already trimmed and lower-cased.
export function validateAccount(form, email) {
  const errors = {}
  if (!form.role) errors.role = 'Select a role'
  if (!form.fullName.trim()) errors.fullName = 'Full name is required'
  if (!email) errors.email = 'Email is required'
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Enter a valid email address'
  // The Purchase Officer covers every branch; Inventory Officers and Cashiers work at one
  if (!form.branchId && !coversAllBranches(form.role)) errors.branchId = 'Assign a branch'
  return errors
}
