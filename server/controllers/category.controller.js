import { toResource } from '../models/category.model.js'
import * as categoryService from '../services/category.service.js'

// Add Category & Product (Purchase Officer) and the Category dropdown of Create Procurement

export async function index(req, res) {
  const rows = await categoryService.list()
  res.json({ data: rows.map(toResource) })
}

export async function store(req, res) {
  const category = await categoryService.create(req, req.body.name)
  res.status(201).json({ message: `Category "${category.name}" added.`, category: toResource(category) })
}

export async function update(req, res) {
  const category = await categoryService.rename(req, req.categoryId, req.body.name)
  res.json({ message: `Category renamed to "${category.name}".`, category: toResource(category) })
}

export async function destroy(req, res) {
  const category = await categoryService.remove(req, req.categoryId)
  res.json({ message: `Category "${category.name}" deleted. Past orders keep it.` })
}
