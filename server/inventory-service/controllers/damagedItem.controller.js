import { toResource } from '../models/damagedItem.model.js'
import * as damagedItemService from '../services/damagedItem.service.js'

/** GET /damaged-items */
export async function index(req, res) {
  res.json({ data: (await damagedItemService.list(req.user)).map(toResource) })
}

/** POST /damaged-items (req.validated from the validator) */
export async function store(req, res) {
  const { item, damagedItem } = await damagedItemService.record(req, req.validated)

  res.status(201).json({ message: `${item.id} recorded.`, damagedItem })
}
