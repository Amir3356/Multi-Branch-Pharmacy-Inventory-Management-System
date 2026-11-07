import { DateTime } from '../../utils/index.js'
import { localNow, parseDate } from '../../utils/dates.js'
import { normalizeInput, rule, validateRules } from '../../utils/rules.js'
import { PERIODS } from '../../models/accessReview.model.js'

/** POST /access-reviews (GenerateAccessReviewRequest): req.body becomes the normalized, validated input */
export function validateGenerateAccessReview(req, res, next) {
  // "Today" in the store's local time, not the server's UTC date
  const today = localNow().toISODate()
  // before_or_equal / after_or_equal compared timestamps in the app's time zone (UTC)
  const utc = (value) => parseDate(value, 'utc')
  const notAfterToday = (value) => utc(value).toMillis() <= DateTime.fromISO(today, { zone: 'utc' }).toMillis()
  const input = normalizeInput(req.body)
  const isCustom = (data) => data.period !== null && data.period !== undefined && String(data.period) === 'custom'

  validateRules(
    {
      period: { rules: [rule.required(), rule.in([...PERIODS, 'custom'])] },
      // current = this period so far (Partial); previous = the last finished one (Complete)
      scope: { nullable: true, rules: [rule.in(['current', 'previous'])] },
      from: {
        nullable: true,
        rules: [
          rule.requiredIf(isCustom, 'Choose a start date.'),
          rule.check((value) => utc(value) !== null, 'The from field must be a valid date.'),
          // An unparseable date only gets the `date` message, as Laravel's date comparisons pass on it
          rule.check((value) => utc(value) === null || notAfterToday(value), "The start date can't be in the future."),
        ],
      },
      to: {
        nullable: true,
        rules: [
          rule.requiredIf(isCustom, 'Choose an end date.'),
          rule.check((value) => utc(value) !== null, 'The to field must be a valid date.'),
          rule.check(
            (value, data) => utc(value) === null || utc(data.from) === null || utc(value).toMillis() >= utc(data.from).toMillis(),
            'The end date must be on or after the start date.',
          ),
          rule.check((value) => utc(value) === null || notAfterToday(value), "The end date can't be in the future."),
        ],
      },
    },
    input,
  )
  req.body = input
  next()
}
