import { config } from '../config/index.js'
import { TtlCache } from './ttlCache.js'

/**
 * Turns a device's latitude/longitude into "City, Sub-city, Country" (e.g. "Addis Ababa, Bole, Ethiopia")
 * using OpenStreetMap's free Nominatim service. Its usage policy asks for an app name in each request,
 * at most one request per second, and caching, so each ~100 m spot is looked up once per 30 days.
 */
const cache = new TtlCache(30 * 86_400_000)

export async function name(latitude, longitude) {
  const key = `place-name:${latitude.toFixed(3)},${longitude.toFixed(3)}`

  return cache.remember(key, async () => {
    let address
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(latitude),
        lon: String(longitude),
        zoom: '16',
        addressdetails: '1',
        'accept-language': 'en',
      })
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { 'User-Agent': `${config.appName} Session Monitoring (${config.appUrl})`, Accept: 'application/json' },
        signal: AbortSignal.timeout(6_000),
      })
      address = (await response.json())?.address
    } catch {
      return null
    }
    return address && typeof address === 'object' ? format(address) : null
  })
}

function format(address) {
  // Addis Ababa's sub-cities (Bole, Kirkos, Arada…) come back as "county"; the city is often only the state
  const city = address.city ?? address.town ?? address.village ?? address.state_district ?? address.state ?? null
  const area = address.county ?? address.city_district ?? address.suburb ?? address.neighbourhood ?? null
  const parts = [...new Set([city, area, address.country ?? null].filter(Boolean))]
  return parts.length ? parts.join(', ') : null
}
