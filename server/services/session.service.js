import { HttpError, abort, audit, broadcast, config, describeDevice, logger } from '../utils/index.js'
import { INACTIVITY_REASON, KEEP_DAYS } from '../models/session.model.js'
import * as repository from '../repositories/session.repository.js'
import * as signIns from '../repositories/signIn.repository.js'
import * as ipLocator from '../utils/ipLocator.js'
import * as places from '../utils/placeNamer.js'

// Activity is pushed to the Owner at most this often per session
const ACTIVITY_PUSH_SECONDS = 60
// When an IP's location couldn't be found, it is tried again at most this often per session (not on every request)
const LOCATION_RETRY_MS = 10 * 60_000
const lastLocationTry = new Map()

/**
 * A session is one token row. Ending a session keeps the row (for the Owner's history) but stamps ended_at, which
 * makes introspection reject it on the next request.
 *
 * Create one per request (Laravel scoped it to the request), so several session changes in a request send a single
 * "sessions changed" push.
 */
export class SessionService {
  // One push per request is enough: the Owner's page reloads the whole list
  #announced = false

  /** Tells the Owner's page that sessions changed. Fire-and-forget: a stopped notification service never breaks the request. */
  announce(reason) {
    if (this.#announced) return
    this.#announced = true
    this.#broadcast(reason)
  }

  /** Called for every request made with a token: keeps the IP current and pushes activity now and then. */
  async recordActivity(token, ip) {
    // last_used_at isn't stamped for this request yet, so it is still the previous request's time
    const previous = token.last_used_at ? new Date(token.last_used_at) : null
    await this.recordAddress(token, ip)

    if (!previous || previous.getTime() <= Date.now() - ACTIVITY_PUSH_SECONDS * 1000) {
      this.announce('activity')
    }
  }

  /**
   * Stores the session's current IP; when it changed, works out the location in the background, so signing in never
   * waits on the lookup.
   */
  async recordAddress(token, ip) {
    if (!ip) return
    const changed = token.ip_address !== ip
    if (!changed && token.location !== null) return

    if (changed) {
      await repository.setAddress(token.id, ip)
      token.ip_address = ip
    }

    // The device's own location (more precise) is kept; the IP only fills in when there's none
    if (token.location_source === 'device') return

    // Same IP, still no location: don't hit the lookup service on every request
    const key = `${token.id}|${ip}`
    if (!changed && Date.now() - (lastLocationTry.get(key) ?? 0) < LOCATION_RETRY_MS) return
    if (lastLocationTry.size > 5_000) lastLocationTry.clear()
    lastLocationTry.set(key, Date.now())

    ;(async () => {
      const location = await ipLocator.locate(ip)
      if (location && (await repository.locationSource(token.id)) !== 'device') {
        await repository.setLocation(token.id, location, 'ip')
        this.#broadcast('location')
      }
    })().catch((error) => logger.warn('Session location not saved', { session: token.id, error: error.message }))
  }

  /**
   * Ends the session if it hasn't been used for the timeout (SESSION_TIMEOUT_MINUTES). Checked on every request,
   * before this one is stamped; returns true when it ended it.
   */
  async expireIfInactive(token) {
    const minutes = config.sessionTimeoutMinutes
    const lastUsed = new Date(token.last_used_at ?? token.created_at)
    if (!minutes || lastUsed.getTime() > Date.now() - minutes * 60_000) return false

    await this.end(token, INACTIVITY_REASON)
    return true
  }

  /** Ends every open session past the timeout, e.g. a browser closed without signing out. */
  async expireInactiveSessions() {
    const minutes = config.sessionTimeoutMinutes
    if (!minutes) return

    for (const token of await repository.openInactiveFor(minutes)) {
      await this.end(token, INACTIVITY_REASON)
    }
  }

  async end(token, reason) {
    if (token.ended_at === null && (await repository.markEnded(token.id, reason))) {
      this.notifyEnded([token.id], reason)
      this.announce('ended')
    }
  }

  /** Signs the user out on every device; returns how many sessions were open. */
  async endAllFor(userId, reason) {
    const open = await repository.openIdsFor(userId)
    if (!open.length) return 0

    await repository.markManyEnded(userId, open, reason)
    this.notifyEnded(open, reason)
    this.announce('ended')

    return open.length
  }

  /**
   * Tells each affected browser its session is over, so it signs out at once instead of on its next click. If the
   * notification service is down, the browser still signs out on its next request.
   */
  notifyEnded(sessionIds, reason) {
    for (const id of sessionIds) broadcast(`session.${id}`, 'session.ended', { reason })
  }

  #broadcast(reason) {
    broadcast('sessions', 'sessions.changed', { reason })
  }
}

/** Every signed-in user: stores this session's place name from the browser's location; returns it (or null) */
export async function saveDeviceLocation(tokenId, latitude, longitude) {
  // The place name is part of the answer, so this one lookup is awaited (6 s timeout, cached)
  const location = await places.name(latitude, longitude)
  if (location && tokenId) {
    await repository.setLocation(tokenId, location, 'device')
    new SessionService().announce('location')
  }
  return location
}

/** Route model binding for {session}: any token row, or Laravel's 404 */
export async function findSession(id) {
  const session = /^\d+$/.test(String(id)) ? await repository.withUser(Number(id)) : null
  if (!session) throw new HttpError(404, `No query results for model [App\\Features\\Sessions\\Models\\SessionToken] ${id}`)
  return session
}

function ensureNotCurrent(session, currentTokenId) {
  if (session.id === currentTokenId) abort(422, 'This is your current session. Use Sign Out instead.')
}

/** Every sign-in from the last 7 days (tokens can't live longer): open sessions first, then by latest activity. */
export async function listRecent() {
  // Housekeeping (also scheduled): rows older than 30 days can't sign in and are never shown
  await repository.pruneOlderThan(KEEP_DAYS)
  // Sessions abandoned without signing out (browser closed) end once they pass the timeout
  await new SessionService().expireInactiveSessions()

  return repository.recent(7)
}

/** The Owner signs a session out; returns the session as it was, its device, and the row as it is now */
export async function endByOwner(req, id) {
  const session = await findSession(id)
  ensureNotCurrent(session, req.tokenId)
  await new SessionService().end(session, 'Ended by the Owner')
  const device = describeDevice(session.name)
  audit(req, {
    module: 'Sessions',
    action: 'Session ended',
    recordId: String(session.id),
    description: `${session.email ?? ''} was signed out on ${device} by the Owner.`,
    branchId: session.branch_id ?? null,
    type: 'update',
    before: { email: session.email, device, endedAt: session.ended_at },
    after: { email: session.email, device, ended: 'Ended by the Owner' },
  })

  return { session, device, updated: await repository.withUser(session.id) }
}

/** Removes the session from the list, signing it out first if it was still open; returns its email */
export async function removeByOwner(req, id) {
  const session = await findSession(id)
  ensureNotCurrent(session, req.tokenId)
  const email = session.email ?? ''
  const wasOpen = session.ended_at === null
  await repository.remove(session.id)
  audit(req, {
    module: 'Sessions',
    action: 'Session removed',
    recordId: String(session.id),
    description: `${email}’s session on ${describeDevice(session.name)} was removed from the list${wasOpen ? ' (it was still open, so it was signed out).' : '.'}`,
    branchId: session.branch_id ?? null,
    type: 'delete',
    before: { email, device: describeDevice(session.name), ip: session.ip_address ?? null, open: wasOpen },
  })
  const sessions = new SessionService()
  if (wasOpen) sessions.notifyEnded([session.id], 'Ended by the Owner')
  sessions.announce('removed')

  return email
}

/** Ends every open session of the user (account deactivated), tells their browsers and refreshes the Owner's list */
export async function endAllFor(userId, reason) {
  return new SessionService().endAllFor(userId, reason)
}

/** Same, but removes the rows (account deleted); returns how many */
export async function deleteAllFor(userId, reason) {
  const sessions = new SessionService()
  const open = await repository.openIdsFor(userId)
  const deleted = await repository.deleteAllFor(userId)
  // The account is being deleted: its sign-in history goes with it, as the old foreign key's cascade did
  await signIns.deleteAllFor(userId)
  sessions.notifyEnded(open, reason)
  sessions.announce('removed')
  return deleted
}

/**
 * Scheduled every 5 minutes: signs out sessions left open past SESSION_TIMEOUT_MINUTES (e.g. a browser closed without
 * signing out), so Session Monitoring is right even when nobody has the page open
 */
export async function expireInactiveSessions() {
  return new SessionService().expireInactiveSessions()
}

/** Scheduled daily: rows older than 30 days can't sign in (tokens expire after 7) and are never shown */
export async function pruneOldSessions() {
  const pruned = await repository.pruneOlderThan(KEEP_DAYS)
  if (pruned) logger.info(`Pruned ${pruned} old sessions`)
}
