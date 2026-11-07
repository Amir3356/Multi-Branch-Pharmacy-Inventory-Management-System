import { abort, audit, broadcast, money, nextId, transaction } from '../utils/index.js'
import { modelNotFound, nowSeconds, phpRound } from '../utils/php.js'
import * as expenses from '../repositories/expense.repository.js'
import { ID_PREFIX, MODEL_CLASS, TABLE } from '../models/expense.model.js'

// Pushed to a branch when an expense is recorded or deleted, so its open screens reload the list
const announce = (branchId) => broadcast(`branch.${branchId}.expenses`, 'expenses.changed', { branchId })

/** A branch's expenses, recorded by its Inventory Officer; the Owner and Purchase Officer can read all */
export function visibleTo(user) {
  return expenses.visibleTo(user)
}

/** Records a validated expense at the signed-in Inventory Officer's branch. Returns the saved row. */
export async function record(req, data) {
  const saved = await transaction(async (client) =>
    expenses.insert(client, {
      id: await nextId(client, TABLE, ID_PREFIX),
      branch_id: req.user.branchId,
      category: data.category,
      description: data.description ?? null,
      amount: phpRound(data.amount, 2),
      expense_date: data.date,
      recorded_by: req.user.id,
      created_at: nowSeconds(),
    }),
  )
  const expense = { ...saved, recorder_name: req.user.fullName }

  announce(expense.branch_id)
  audit(req, {
    module: 'Expenses',
    action: 'Expense recorded',
    recordId: expense.id,
    description: `${expense.category}${expense.description ? ` (${expense.description})` : ''}: ${money(expense.amount)} on ${data.date}.`,
    branchId: expense.branch_id,
    after: saved,
  })

  return expense
}

/** Deletes an expense of the signed-in Inventory Officer's own branch. Returns the deleted row. */
export async function remove(req, id) {
  const expense = await expenses.find(id)
  if (!expense) throw modelNotFound(MODEL_CLASS, id)
  if (expense.branch_id !== req.user.branchId) abort(403, 'This expense belongs to another branch.')

  await expenses.remove(expense.id)
  audit(req, {
    module: 'Expenses',
    action: 'Expense deleted',
    recordId: expense.id,
    description: `${expense.category} expense of ${money(expense.amount)} was deleted.`,
    branchId: expense.branch_id,
    before: expense,
  })
  announce(expense.branch_id)

  return expense
}
