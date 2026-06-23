import * as accessReviewService from '../../services/accessReview.service.js'

/** Route-model binding for /access-reviews/:accessReview: req.accessReview, or Laravel's 404 */
export async function loadAccessReview(req, res, next) {
  req.accessReview = await accessReviewService.findOrFail(req.params.accessReview)
  next()
}
