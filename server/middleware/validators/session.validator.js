import { validate, z } from '../../utils/index.js'

const trimmed = (value) => (typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value)

const deviceLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).nullable().optional(),
})

/** POST /sessions/current/location → req.body = { latitude, longitude, accuracy } */
export function validateDeviceLocation(req, res, next) {
  try {
    const data = {
      latitude: trimmed(req.body?.latitude),
      longitude: trimmed(req.body?.longitude),
      accuracy: trimmed(req.body?.accuracy),
    }
    validate(deviceLocationSchema, data)
    req.body = data
    next()
  } catch (error) {
    next(error)
  }
}
