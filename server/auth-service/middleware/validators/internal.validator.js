import { z } from '../../utils/index.js'
import { validateBody } from '../index.js'

/** Bodies of the service-to-service session endpoints (validateBody replaces req.body with the parsed value) */
const userId = z.coerce.number({ error: 'The userId field must be a number.' }).int().positive()
const reason = z.string({ error: 'The reason field is required.' }).min(1, { error: 'The reason field is required.' }).max(60)

/** POST /internal/auth/issue-token { userId } */
export const validateIssueToken = validateBody(z.object({ userId }))

/** POST /internal/sessions/end-all and /internal/sessions/delete-all { userId, reason } */
export const validateUserSessions = validateBody(z.object({ userId, reason }))
