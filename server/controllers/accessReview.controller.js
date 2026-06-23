import * as accessReviewService from '../services/accessReview.service.js'
import { presentAccessReview } from '../models/accessReview.model.js'

/** User (access review) reports (Laravel's AccessReviewController): HTTP in, JSON out */

export async function index(req, res) {
  const rows = await accessReviewService.latest()
  res.json({ data: rows.map((review) => presentAccessReview(review)) })
}

export async function store(req, res) {
  const { review, replaced } = await accessReviewService.generateManual(req, req.body)
  res.status(201).json({
    message: replaced.length ? 'User report updated with the latest data.' : 'User report generated.',
    review: presentAccessReview(review),
    // Earlier reports for the same period that this one replaces
    replacedIds: replaced,
  })
}

export async function show(req, res) {
  const { id } = req.accessReview
  res.json({ data: presentAccessReview(await accessReviewService.findWithPeople(id), { withRows: true }) })
}

export async function destroy(req, res) {
  await accessReviewService.remove(req, req.accessReview)
  res.json({ message: 'User report deleted.' })
}
