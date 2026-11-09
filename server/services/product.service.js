import { HttpError, audit, broadcast, isUniqueViolation, money, nextId, transaction, validationError } from '../utils/index.js'
import * as categories from '../repositories/category.repository.js'
import {
  addBatch,
  allBatches,
  allProducts,
  batchesOf,
  createProduct,
  deleteProduct,
  findSameName,
  hasStock,
  setPrices,
  updateProduct,
} from '../repositories/product.repository.js'

/** The whole catalog, by category then name, each product with its Batch IDs (oldest first) */
export async function list() {
  const [products, batches] = await Promise.all([allProducts(), allBatches()])
  const byProduct = new Map()
  for (const b of batches) byProduct.set(b.product_id, [...(byProduct.get(b.product_id) ?? []), b])
  return products.map((p) => ({ ...p, batches: byProduct.get(p.id) ?? [] }))
}

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
  const category = await categories.findByName(name)
  if (!category) throw validationError({ category: 'Choose a category from the list. Add new ones on the Category & Product page.' })
  return category.name
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
    // Its first Batch ID is generated now, on save; procurements buy under it and the Inventory Officer receives the
    // stock under the same one. Taken from the shared 'batches' counter, so it never clashes with another batch.
    product = await transaction(async (client) => {
      const created = await createProduct(client, { id: await nextId(client, 'products', 'MED'), name: data.name, category, batch: null })
      const withBatch = await addBatch(client, created.id, await nextId(client, 'batches', 'BT'), req.user.id)
      return { ...withBatch, batches: await batchesOf(created.id, client) }
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate(data.name, category)
    throw error
  }
  audit(req, { module: 'Products', action: 'Product added', recordId: product.id, description: `${product.name} added to ${category} with Batch ID ${product.batch}.`, type: 'create', after: product })
  announceProducts()
  return product
}

/** Another Batch ID for a product already in the catalog: the same product and category, bought as a new batch */
export async function createBatch(req, product) {
  const updated = await transaction(async (client) => {
    const withBatch = await addBatch(client, product.id, await nextId(client, 'batches', 'BT'), req.user.id)
    return { ...withBatch, batches: await batchesOf(product.id, client) }
  })
  audit(req, { module: 'Products', action: 'Batch added', recordId: product.id, description: `New Batch ID ${updated.batch} for ${product.name} (${product.category}).`, type: 'create', before: product, after: updated })
  announceProducts()
  return updated
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

