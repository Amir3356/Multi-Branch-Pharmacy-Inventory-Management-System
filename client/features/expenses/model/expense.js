// A branch expense, as the API sends it (server: Expenses/Resources/ExpenseResource.php)

/**
 * @typedef {object} Expense
 * @property {string} id                 e.g. "EXP-00001"
 * @property {string} branchId
 * @property {string} category           one of EXPENSE_CATEGORIES
 * @property {string | null} description
 * @property {number} amount
 * @property {string} date               YYYY-MM-DD it was paid
 * @property {string | null} recordedBy
 *
 * Sent to POST /expenses (the branch is the officer's own)
 * @typedef {{ category: string, amount: number, date: string, description?: string }} ExpensePayload
 */

// What a branch spends on (the server accepts the same list)
export const EXPENSE_CATEGORIES = [
  'Rent',
  'Transportation',
  'Utilities (Electricity & Water)',
  'Salaries & Wages',
  'Maintenance & Repairs',
  'Supplies & Stationery',
  'Communication (Phone & Internet)',
  'Taxes & Licenses',
  'Cleaning & Security',
  'Other'
]

export const emptyExpenseForm = (today) => ({ category: '', amount: '', date: today, description: '' })

/** @returns {ExpensePayload} */
export const toExpensePayload = (form) => ({
  category: form.category,
  amount: Math.round(Number(form.amount) * 100) / 100,
  date: form.date,
  description: form.description.trim() || undefined
})
