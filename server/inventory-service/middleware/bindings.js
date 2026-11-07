import { findProduct } from '../repositories/product.repository.js'
import { findBatch } from '../repositories/stock.repository.js'
import { findTransfer } from '../repositories/transfer.repository.js'
import { MODELS, modelNotFound } from '../utils/support.js'

/**
 * Route-model binding (Laravel's implicit binding): loads the record named in the path onto req, or answers with
 * Laravel's 404 word for word. Put each after the role check, as in Laravel's middleware order.
 */

/** :product → req.product */
export async function bindProduct(req, res, next) {
  const product = await findProduct(req.params.product)
  if (!product) throw modelNotFound(MODELS.product, req.params.product)
  req.product = product
  next()
}

/** :stockBatch → req.stockBatch. Runs before branch.active, as in Laravel's middleware order */
export async function bindStockBatch(req, res, next) {
  const id = req.params.stockBatch
  const batch = /^\d+$/.test(id) ? await findBatch(id) : null
  if (!batch) throw modelNotFound(MODELS.stockBatch, id)
  req.stockBatch = batch
  next()
}

/** :transfer → req.transfer */
export async function bindTransfer(req, res, next) {
  const found = await findTransfer(req.params.transfer)
  if (!found) throw modelNotFound(MODELS.transfer, req.params.transfer)
  req.transfer = found
  next()
}
