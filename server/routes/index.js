import { Router } from 'express'
import { authRouter } from './auth.routes.js'
import { sessionsRouter } from './session.routes.js'
import accountRouter from './account.routes.js'
import invitationRouter from './invitation.routes.js'
import accessReviewRouter from './accessReview.routes.js'
import branchRouter from './branch.routes.js'
import policyRouter from './policy.routes.js'
import { productRouter } from './product.routes.js'
import { stockRouter } from './stock.routes.js'
import { transferRouter } from './transfer.routes.js'
import { damagedItemRouter } from './damagedItem.routes.js'
import categoryRouter from './category.routes.js'
import procurementRouter from './procurement.routes.js'
import salesRouter from './sale.routes.js'
import expensesRouter from './expense.routes.js'
import { reportRouter } from './report.routes.js'
import { ownerDashboardRouter } from './ownerDashboard.routes.js'
import { auditLogRouter } from './auditLog.routes.js'
import { aiRouter } from './ai.routes.js'

export const apiRouter = Router()

// Mount feature routers (categories before procurements so /procurements/categories is matched first)
apiRouter.use(authRouter)
apiRouter.use(sessionsRouter)
apiRouter.use(accountRouter)
apiRouter.use(invitationRouter)
apiRouter.use(accessReviewRouter)
apiRouter.use(branchRouter)
apiRouter.use(policyRouter)
apiRouter.use(productRouter)
apiRouter.use(stockRouter)
apiRouter.use(transferRouter)
apiRouter.use(damagedItemRouter)
apiRouter.use(categoryRouter)
apiRouter.use(procurementRouter)
apiRouter.use(salesRouter)
apiRouter.use(expensesRouter)
apiRouter.use(reportRouter)
apiRouter.use(ownerDashboardRouter)
apiRouter.use(auditLogRouter)
apiRouter.use(aiRouter)

export default apiRouter
