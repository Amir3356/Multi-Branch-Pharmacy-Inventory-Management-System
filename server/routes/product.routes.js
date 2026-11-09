import { Router } from '../utils/index.js'
import { requireAuth, requireRole, validateBody } from '../middleware/index.js'
import { bindProduct } from '../middleware/bindings.js'
import { productSchema, validateSellingPrice } from '../middleware/validators/product.validator.js'
import * as productController from '../controllers/product.controller.js'

/**
 * The product catalog: every page that picks a product reads it; prices are shared by every branch.
 *   GET /products                         every signed-in role
 *   PUT /products/:product/selling-price  Inventory Officer
 *   POST /products                        Purchase Officer (Add Category & Product); gets its first Batch ID
 *   POST /products/:product/batches       Purchase Officer: another Batch ID for a product already in the catalog
 *   PATCH|DELETE /products/:product       Purchase Officer, only before the product has stock
 */
export const productRouter = Router()

productRouter.get('/products', requireAuth, productController.index)
productRouter.put('/products/:product/selling-price', requireRole('inventory_officer'), bindProduct, validateSellingPrice, productController.updateSellingPrice)
productRouter.post('/products', requireRole('purchase_officer'), validateBody(productSchema), productController.store)
productRouter.post('/products/:product/batches', requireRole('purchase_officer'), bindProduct, productController.storeBatch)
productRouter.patch('/products/:product', requireRole('purchase_officer'), bindProduct, validateBody(productSchema), productController.update)
productRouter.delete('/products/:product', requireRole('purchase_officer'), bindProduct, productController.destroy)
