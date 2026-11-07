// A signed-in session, as the API sends it (server: Sessions/Resources/SessionResource.php)

/**
 * @typedef {object} ApiSession
 * @property {number} id
 * @property {number} userId
 * @property {string} fullName
 * @property {string} email
 * @property {string} role
 * @property {string} roleLabel
 * @property {string} branchId              'all' for the Owner
 * @property {string} device                e.g. "Chrome on Linux"
 * @property {string | null} ip
 * @property {string | null} location
 * @property {'device' | 'ip' | null} locationSource device = precise (from the browser), ip = city only
 * @property {string} signedInAt            ISO timestamp
 * @property {string} lastActiveAt          ISO timestamp
 * @property {'Open' | 'Ended'} status
 * @property {string | null} endedAt        ISO timestamp
 * @property {string | null} endedReason
 * @property {boolean} current              the Owner's own browser
 *
 * The same session in the store: the three timestamps are milliseconds
 * @typedef {Omit<ApiSession, 'signedInAt' | 'lastActiveAt' | 'endedAt'> & { signedInAt: number, lastActiveAt: number, endedAt: number | null }} Session
 *
 * Sent to POST /sessions/current/location
 * @typedef {{ latitude: number, longitude: number, accuracy?: number }} DeviceLocationPayload
 */

const toMs = (iso) => (iso ? new Date(iso).getTime() : null)

/** @returns {Session} */
export const sessionFromApi = (s) => ({ ...s, signedInAt: toMs(s.signedInAt), lastActiveAt: toMs(s.lastActiveAt), endedAt: toMs(s.endedAt) })
