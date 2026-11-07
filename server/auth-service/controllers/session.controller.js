import { config } from '../utils/index.js'
import { toSessionResource } from '../models/session.model.js'
import * as sessions from '../services/session.service.js'

/**
 *   POST   /sessions/current/location  { latitude, longitude, accuracy? } → { location }   (any signed-in user)
 *   GET    /sessions                   → { data: [session], meta }   (Owner: Session Monitoring & Management)
 *   POST   /sessions/:session/end      → { message, session }
 *   DELETE /sessions/:session          → { message }
 */

/** Every signed-in user: the browser reports this session's location, if the person allowed it */
export async function saveLocation(req, res) {
  const location = await sessions.saveDeviceLocation(req.tokenId, Number(req.body.latitude), Number(req.body.longitude))
  res.json({ location })
}

export async function index(req, res) {
  const rows = await sessions.listRecent()
  res.json({
    data: rows.map((session) => toSessionResource(session, req.tokenId)),
    meta: {
      idleAfterMinutes: config.sessionIdleMinutes,
      signOutAfterMinutes: config.sessionTimeoutMinutes,
    },
  })
}

export async function end(req, res) {
  const { session, device, updated } = await sessions.endByOwner(req, req.params.session)
  res.json({
    message: `${session.email ?? ''} was signed out on ${device}.`,
    session: toSessionResource(updated, req.tokenId),
  })
}

/** Removes the session from the list, signing it out first if it was still open. */
export async function destroy(req, res) {
  const email = await sessions.removeByOwner(req, req.params.session)
  res.json({ message: `Session for ${email} removed.` })
}
