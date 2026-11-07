import { Router } from '../utils/index.js'
import { requireRole, validateBody } from '../middleware/index.js'
import { bindCategoryId, categorySchema } from '../middleware/validators/category.validator.js'
import * as controller from '../controllers/category.controller.js'

// Procurement categories. The Purchase Officer adds them (Add Category & Product); the Owner and the Inventory Officer
// can read them (the Inventory page's category filter lists them).
// Under /procurements so the API gateway and nginx already route it here.
const router = Router()

router.get('/procurements/categories', requireRole('purchase_officer', 'owner', 'inventory_officer'), controller.index)
router.post('/procurements/categories', requireRole('purchase_officer'), validateBody(categorySchema), controller.store)
router.patch('/procurements/categories/:category', requireRole('purchase_officer'), bindCategoryId, validateBody(categorySchema), controller.update)
router.delete('/procurements/categories/:category', requireRole('purchase_officer'), bindCategoryId, controller.destroy)

export default router
