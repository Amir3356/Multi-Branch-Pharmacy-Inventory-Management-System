import { HttpError, audit, isUniqueViolation, notFound, serviceClient, validationError } from '../utils/index.js'
import { NAME_UNIQUE_INDEX } from '../models/category.model.js'
import * as categories from '../repositories/category.repository.js'

// Procurement categories: added by the Purchase Officer (Add Category & Product), offered in Create Procurement

export const list = () => categories.all()

const duplicate = (name) => validationError({ name: `A category named "${name}" already exists.` })

async function findOrFail(id) {
  const category = await categories.find(id)
  if (!category) throw notFound('That category no longer exists.')
  return category
}

/** Catalog products (inventory-service) are filed under the category's name; it stays fixed while any are */
async function refuseIfUsed(req, category, doing) {
  const { count } = await serviceClient('inventory').get(`/internal/products/category-count?category=${encodeURIComponent(category.name)}`, { req })
  if (count > 0) {
    throw new HttpError(422, `${count} product${count === 1 ? ' is' : 's are'} in "${category.name}", so it can't be ${doing}. Move or delete ${count === 1 ? 'it' : 'them'} first.`)
  }
}

export async function create(req, name) {
  let category
  try {
    category = await categories.create(name, req.user.id)
  } catch (error) {
    if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) throw duplicate(name)
    throw error
  }
  audit(req, { module: 'Procurement', action: 'Category added', recordId: category.id, description: `Category "${name}" added.`, type: 'create', after: category })
  return category
}

/** Past orders keep the name they were placed under */
export async function rename(req, id, name) {
  const before = await findOrFail(id)
  if (before.name !== name) await refuseIfUsed(req, before, 'renamed')
  let category
  try {
    category = await categories.rename(id, name)
  } catch (error) {
    if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) throw duplicate(name)
    throw error
  }
  audit(req, { module: 'Procurement', action: 'Category renamed', recordId: id, description: `Category "${before.name}" renamed to "${name}".`, type: 'update', before, after: category })
  return category
}

/** Past orders keep their category name; it just can't be picked for new ones */
export async function remove(req, id) {
  const category = await findOrFail(id)
  await refuseIfUsed(req, category, 'deleted')
  await categories.remove(id)
  audit(req, { module: 'Procurement', action: 'Category deleted', recordId: id, description: `Category "${category.name}" deleted.`, type: 'delete', before: category })
  return category
}
