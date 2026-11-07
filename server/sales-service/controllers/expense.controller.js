import * as expensesService from '../services/expense.service.js'
import { toResource } from '../models/expense.model.js'

export async function index(req, res) {
  const rows = await expensesService.visibleTo(req.user)
  res.json({ data: rows.map(toResource) })
}

export async function store(req, res) {
  const expense = await expensesService.record(req, req.validated)
  res.status(201).json({ message: `Expense ${expense.id} recorded.`, expense: toResource(expense) })
}

export async function destroy(req, res) {
  const expense = await expensesService.remove(req, req.params.expense)
  res.json({ message: `Expense ${expense.id} deleted.` })
}
