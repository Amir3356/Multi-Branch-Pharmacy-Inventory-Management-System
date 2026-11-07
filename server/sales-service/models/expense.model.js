// What a branch spends, recorded by its Inventory Officer
export const TABLE = 'expenses'
export const ID_PREFIX = 'EXP'
// The model name Laravel's 404 message carries
export const MODEL_CLASS = 'App\\Features\\Expenses\\Models\\Expense'

// What a branch spends on; the client offers the same list
export const CATEGORIES = [
  'Rent',
  'Transportation',
  'Utilities (Electricity & Water)',
  'Salaries & Wages',
  'Maintenance & Repairs',
  'Supplies & Stationery',
  'Communication (Phone & Internet)',
  'Taxes & Licenses',
  'Cleaning & Security',
  'Other',
]

/** ExpenseResource. `expense.recorder_name` is the recorder's full name (null once the account is deleted). */
export function toResource(expense) {
  return {
    id: expense.id,
    branchId: expense.branch_id,
    category: expense.category,
    description: expense.description,
    amount: Number(expense.amount),
    date: expense.expense_date,
    recordedBy: expense.recorder_name ?? null,
  }
}
