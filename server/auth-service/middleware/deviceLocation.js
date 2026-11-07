import { config } from '../utils/config.js'
import { HttpError } from '../utils/errors.js'

/** POST /sessions/current/location exists only when DEVICE_LOCATION is on; otherwise an empty 404 */
export function requireDeviceLocation(req, res, next) {
  return config.deviceLocation ? next() : next(new HttpError(404, ''))
}
