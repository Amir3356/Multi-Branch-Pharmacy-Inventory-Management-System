import { toUserContext } from '../utils/index.js'

/**
 * The users row (owned by user-service; auth reads it and writes only password and last_login_at). Statuses are
 * ACCOUNT_STATUSES and the account payloads presentAuthUser / toUserContext, both shared in utils/.
 */
export const TABLE = 'users'

/** The users row as the audit log's actor */
export const actorOf = (user) => (user ? toUserContext(user) : null)
