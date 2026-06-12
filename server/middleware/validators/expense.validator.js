import { storeToday } from '../../utils/index.js'
import { normalizeInput } from '../../utils/helpers.js'
import { validateRules } from '../../utils/validation.js'
import { CATEGORIES } from '../../models/expense.model.js'

/**
 * StoreExpenseRequest: an expense at their own branch, on a day up to today. Leaves the validated input on
 * req.validated.
 */
export async function validateStoreExpense(req, res, next) {
  const input = normalizeInput(req.body ?? {})
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const data = { ...input, description: description === '' || description === '0' ? null : description }
  const today = storeToday()

  await validateRules(
    data,
    {
      category: ['required', { name: 'in', values: CATEGORIES }],
      amount: ['required', 'numeric', 'gt:0', 'max:100000000'],
      date: ['required', 'date_format:Y-m-d', `before_or_equal:${today}`],
      description: [{ name: 'required', when: data.category === 'Other' }, 'nullable', 'string', 'max:255'],
    },
    {
      'category.*': 'Select a category',
      'amount.*': 'Enter an amount greater than 0',
      'date.before_or_equal': 'The date can’t be in the future',
      'date.*': 'Enter the date it was paid',
      'description.required': 'Describe what it was for',
    },
  )

  req.validated = data
  next()
}
