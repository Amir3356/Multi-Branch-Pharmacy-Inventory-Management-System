import { Router, notFound } from '../utils/index.js'
import { toResource } from '../models/category.model.js'
import { findByName } from '../repositories/category.repository.js'

/**
 * Service-to-service calls (never routed by the gateway), mounted under /internal.
 *   GET /internal/categories/lookup?name=  → { category }  or 404 (inventory-service, before saving a product)
 */
const router = Router()

router.get('/categories/lookup', async (req, res) => {
  const name = typeof req.query.name === 'string' ? req.query.name.trim() : ''
  const category = name ? await findByName(name) : null
  if (!category) throw notFound('No category with that name.')
  res.json({ category: toResource(category) })
})

export default router
