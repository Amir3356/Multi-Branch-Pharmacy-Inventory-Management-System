import invitationRouter from './invitation.routes.js'
import accountRouter from './account.routes.js'
import accessReviewRouter from './accessReview.routes.js'

/** Mounts every feature router of user-service (invitations first, as before) */
export function registerRoutes(app) {
  app.use(invitationRouter)
  app.use(accountRouter)
  app.use(accessReviewRouter)
}
