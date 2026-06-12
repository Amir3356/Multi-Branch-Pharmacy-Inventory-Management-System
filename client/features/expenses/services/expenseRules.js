// Field errors for the Add Expense form; empty when it can be saved. "Other" needs a description.
export function validateExpense(form, today) {
  const errors = {}
  if (!form.category) errors.category = 'Select an expense category'
  const amount = Number(form.amount)
  if (form.amount === '' || Number.isNaN(amount) || amount <= 0) errors.amount = 'Enter an amount greater than 0'
  if (!form.date) errors.date = 'Enter the expense date'
  else if (form.date > today) errors.date = 'The date can’t be in the future'
  if (form.category === 'Other' && !form.description.trim()) errors.description = 'Describe what it was for'
  return errors
}
