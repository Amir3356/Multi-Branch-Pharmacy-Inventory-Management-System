import { HttpError, audit, broadcast, isUniqueViolation, money, nextId, serviceClient, transaction, validationError } from '../utils/index.js'
import {
  allProducts,
  countInCategory,
  createProduct,
  deleteProduct,
  findSameName,
  hasStock,
  setPrices,
  updateProduct,
} from '../repositories/product.repository.js'

/** The whole catalog, by category then name */
export const list = () => allProducts()

/** Every screen reloads the catalog (e.g. a cashier can sell the product right away) */
export const announceProducts = () => broadcast('products', 'products.changed', {})

/** The product's selling price, at every branch. Returns the updated products row. */
export async function setSellingPrice(req, product, data) {
  const previous = product.selling_price
  // A single UPDATE, as in Laravel (no surrounding transaction)
  const updated = await setPrices(undefined, product.id, null, Number(data.sellingPrice), req.user.id)

  audit(req, {
    module: 'Products',
    action: 'Selling price changed',
    recordId: updated.id,
    description: `${updated.name}: ${previous === null ? 'not set' : money(previous)} → ${money(updated.selling_price)} at every branch.`,
    branchId: req.user.branchId,
    before: product,
    after: updated,
  })
  announceProducts()

  return updated
}

// ---- The Purchase Officer's catalog (Add Category & Product, on the Procurement page) ----

/** The category as procurement-service spells it; 422 when it isn't there */
async function resolveCategory(req, name) {
  try {
    const { category } = await serviceClient('procurement').get(`/internal/categories/lookup?name=${encodeURIComponent(name)}`, { req })
    return category.name
  } catch (error) {
    if (error.status === 404) throw validationError({ category: 'Choose a category from the list. Add new ones on the Category & Product page.' })
    throw error
  }
}

const duplicate = (name, category) => validationError({ name: `"${name}" is already in ${category}.` })

async function checkUnique(name, category, exceptId = null) {
  if (await findSameName(category, name, exceptId)) throw duplicate(name, category)
}

/** Name and category are copied onto every stock batch, so a product that has had stock keeps them */
async function refuseIfStocked(product, doing) {
  if (await hasStock(product.id)) {
    throw new HttpError(422, `${product.name} already has stock, so it can't be ${doing}.`)
  }
}

export async function create(req, data) {
  const category = await resolveCategory(req, data.category)
  await checkUnique(data.name, category)
  let product
  try {
    // No Batch ID yet: one is generated each time the Inventory Officer receives stock of it (Receive Stock)
    product = await transaction(async (client) =>
      createProduct(client, { id: await nextId(client, 'products', 'MED'), name: data.name, category, batch: null }),
    )
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate(data.name, category)
    throw error
  }
  audit(req, { module: 'Products', action: 'Product added', recordId: product.id, description: `${product.name} added to ${category}.`, type: 'create', after: product })
  announceProducts()
  return product
}

export async function update(req, product, data) {
  await refuseIfStocked(product, 'changed')
  const category = await resolveCategory(req, data.category)
  await checkUnique(data.name, category, product.id)
  let updated
  try {
    updated = await updateProduct(product.id, { name: data.name, category })
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate(data.name, category)
    throw error
  }
  audit(req, { module: 'Products', action: 'Product updated', recordId: product.id, description: `${product.name} (${product.category}) → ${updated.name} (${updated.category}).`, type: 'update', before: product, after: updated })
  announceProducts()
  return updated
}

export async function remove(req, product) {
  await refuseIfStocked(product, 'deleted')
  await deleteProduct(product.id)
  audit(req, { module: 'Products', action: 'Product deleted', recordId: product.id, description: `${product.name} removed from ${product.category}.`, type: 'delete', before: product })
  announceProducts()
  return product
}

export const productsInCategory = (category) => countInCategory(category)
