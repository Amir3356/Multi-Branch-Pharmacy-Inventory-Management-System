import { iso8601 } from '../utils/index.js'

/**
 * Access review (user report): a row of access_reviews (period, summary and the per-account row table), the report
 * periods, and its JSON shape (Laravel's AccessReview model and AccessReviewResource).
 */
export const PERIODS = Object.freeze(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])

/** The Luxon unit of each period */
export const UNIT = { daily: 'day', weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year' }

// ACCESS_REVIEW_SCHEDULE: a report for each finished period, just after it ends (store time); empty = off
export const CRON = {
  daily: '0 1 * * *',
  weekly: '0 1 * * 1', // Mondays
  monthly: '0 1 1 * *',
  quarterly: '0 1 1 1,4,7,10 *', // Laravel's quarterlyOn(1, '01:00')
  yearly: '0 1 1 1 *',
}

/** AccessReviewResource; the full row table only when one report is opened (withRows) */
export function presentAccessReview(review, { withRows = false } = {}) {
  return {
    id: review.id,
    periodStart: review.period_start,
    periodEnd: review.period_end,
    periodType: review.period_type,
    scheduled: review.scheduled,
    generatedAt: iso8601(review.created_at),
    // Older reports may have been made by the former automatic schedule
    generatedBy: review.scheduled ? 'Schedule' : (review.generator_name ?? null),
    summary: review.summary,
    reviewedAt: iso8601(review.reviewed_at),
    reviewedBy: review.reviewer_name ?? null,
    reviewNote: review.review_note ?? null,
    ...(withRows ? { rows: review.rows } : {}),
  }
}
