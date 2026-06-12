import { thunkContext } from '../../../redux/thunkHelpers'
import { createExpense, destroyExpense, fetchExpenses } from '../../../api/expensesApi'
import { toExpensePayload } from '../model/expense'
import { expensesLoaded } from './expensesSlice'

// Expense thunks call the API and return the confirmation message; failures throw ApiError

export const loadExpenses = () => async (dispatch) => {
  const { data } = await fetchExpenses()
  dispatch(expensesLoaded(data))
}

export const recordExpense = (form) => async (dispatch, getState) => {
  const { expense } = await createExpense(toExpensePayload(form))
  await dispatch(loadExpenses())
  const { money } = thunkContext(getState)
  return `${expense.category} expense of ${money(expense.amount)} recorded.`
}

export const deleteExpense = (expense) => async (dispatch, getState) => {
  await destroyExpense(expense.id)
  await dispatch(loadExpenses())
  const { money } = thunkContext(getState)
  return `${expense.category} expense of ${money(expense.amount)} deleted.`
}
