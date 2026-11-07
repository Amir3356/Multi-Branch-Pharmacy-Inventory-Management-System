import { Router } from '../utils/index.js'
import { requireRole } from '../middleware/index.js'
import { validateReportPeriod } from '../middleware/validators/report.validator.js'
import * as reportController from '../controllers/report.controller.js'

/** Reports: each for a period (the store's calendar days) and every branch or one. Read only. */
export const reportRouter = Router()

// The Owner's reports
reportRouter.get('/reports/financial', requireRole('owner'), validateReportPeriod, reportController.financial)
reportRouter.get('/reports/users', requireRole('owner'), validateReportPeriod, reportController.users)

// The Procurement Report is the Purchase Officer's too: they buy for every branch
reportRouter.get('/reports/procurement', requireRole('owner', 'purchase_officer'), validateReportPeriod, reportController.procurement)

// The Inventory Officer sees the Inventory Report for their own branch
reportRouter.get('/reports/inventory', requireRole('owner', 'inventory_officer'), validateReportPeriod, reportController.inventory)

// The Cashier sees the Sales Report for their own branch, without purchase-price figures
reportRouter.get('/reports/sales', requireRole('owner', 'cashier'), validateReportPeriod, reportController.sales)
