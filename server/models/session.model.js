import { config, coversAllBranches, describeDevice, iso8601, roleLabel } from '../utils/index.js'
import { normalizeIp } from '../utils/clientIp.js'

/**
 * A session is one row of Sanctum's personal_access_tokens table (one bearer token per signed-in browser). Ending a
 * session keeps the row (for the Owner's history) but stamps ended_at, which makes introspection reject it.
 */
export const TABLE = 'personal_access_tokens'

/** The tokenable_type stored with every token (the users row it belongs to) */
export const TOKENABLE_TYPE = 'App\\Features\\Accounts\\Models\\User'

// Housekeeping: rows older than this can't sign in (tokens expire after 7 days) and are never shown
export const KEEP_DAYS = 30

export const INACTIVITY_REASON = 'Signed out after inactivity'

/** Past Sanctum's expiration (TOKEN_EXPIRATION_MINUTES since it was created) */
export function isExpired(token) {
  const minutes = config.tokenExpirationMinutes
  return Boolean(minutes) && new Date(token.created_at).getTime() <= Date.now() - minutes * 60_000
}

/**
 * SessionResource. `session` is a personal_access_tokens row joined with its user (user_id, full_name, email, role,
 * branch_id: session.repository withUser / recent); `currentTokenId` is the Owner's own session.
 */
export function toSessionResource(session, currentTokenId) {
  const expired = isExpired(session)
  const createdAt = new Date(session.created_at)

  return {
    id: session.id,
    userId: session.user_id,
    fullName: session.full_name,
    email: session.email,
    role: session.role,
    roleLabel: roleLabel(session.role),
    branchId: coversAllBranches(session.role) ? 'all' : session.branch_id,
    device: describeDevice(session.name),
    // Older rows may hold "::ffff:1.2.3.4" or a forged header value; show only a clean IP
    ip: normalizeIp(session.ip_address),
    location: session.location,
    // device = from the browser's location (precise); ip = from the IP address (city only)
    locationSource: session.location_source,
    signedInAt: iso8601(session.created_at),
    lastActiveAt: iso8601(session.last_used_at ?? session.created_at),
    status: session.ended_at || expired ? 'Ended' : 'Open',
    endedAt: session.ended_at
      ? iso8601(session.ended_at)
      : expired
        ? iso8601(new Date(createdAt.getTime() + config.tokenExpirationMinutes * 60_000))
        : null,
    endedReason: session.ended_reason ?? (expired ? 'Expired' : null),
    // The Owner's own browser
    current: session.id === currentTokenId,
  }
}
