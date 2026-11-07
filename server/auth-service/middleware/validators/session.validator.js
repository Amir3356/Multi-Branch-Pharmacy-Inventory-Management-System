import { validate } from '../../utils/index.js'
import { laravelRules, trimmed } from '../../utils/laravelRules.js'

/** POST /sessions/current/location → req.body = { latitude, longitude, accuracy } (trimmed, empty as null) */
export function validateDeviceLocation(req, res, next) {
  try {
    const data = {
      latitude: trimmed(req.body?.latitude),
      longitude: trimmed(req.body?.longitude),
      accuracy: trimmed(req.body?.accuracy),
    }
    validate(
      laravelRules({
        latitude: ['required', 'numeric', 'between:-90,90'],
        longitude: ['required', 'numeric', 'between:-180,180'],
        accuracy: ['nullable', 'numeric', 'min:0'],
      }),
      data,
    )
    req.body = data
    next()
  } catch (error) {
    next(error)
  }
}
