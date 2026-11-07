import { Router } from '../utils/index.js'
import { validateReceive, validateRelease, validateTake } from '../middleware/validators/internalStock.validator.js'
import * as internalStockController from '../controllers/internalStock.controller.js'
import { validateQuery } from '../middleware/index.js'
import { categoryCountQuery } from '../middleware/validators/product.validator.js'
import * as productController from '../controllers/product.controller.js'

/**
 * Service-to-service stock moves (never routed by the gateway), mounted under /internal. See ARCHITECTURE.md,
 * "inventory-service".
 *   POST /internal/stock/take     { reference, branchId, product, parts: [{ batch, qty }], expiredAction } → { batches }
 *   POST /internal/stock/release  { reference } → { released }
 *   POST /internal/stock/receive  { reference, branchId, product, category, medId, expiry, units, receivedAt,
 *                                   purchasePrice?, sellingPrice? } → { batch, product }
 *   GET  /internal/products/category-count?category=  → { count }  (before a category is renamed or deleted)
 */
export const internalRouter = Router()

internalRouter.post('/stock/take', validateTake, internalStockController.take)
internalRouter.post('/stock/release', validateRelease, internalStockController.release)
internalRouter.post('/stock/receive', validateReceive, internalStockController.receive)
internalRouter.get('/products/category-count', validateQuery(categoryCountQuery), productController.categoryCount)
