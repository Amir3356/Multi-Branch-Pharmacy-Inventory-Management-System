import net from 'node:net'
import { config } from './config.js'
import { TtlCache } from './ttlCache.js'

/**
 * Turns an IP address into "City, Country" for Session Monitoring, using ipwho.is (free, no key).
 * Each public IP is looked up once and cached for 30 days; local and private addresses never leave the server.
 */
const cache = new TtlCache(30 * 86_400_000)

export async function locate(ip) {
  if (!ip || !net.isIP(ip)) return null
  if (isPrivateOrReserved(ip)) return 'Local network'
  if (!config.ipLocationLookup) return null

  return cache.remember(`ip-location:${ip}`, async () => {
    let data
    try {
      const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,country`, { signal: AbortSignal.timeout(4_000) })
      data = await response.json()
    } catch {
      return null
    }
    const place = [data?.city, data?.country].filter(Boolean)
    return data?.success && place.length ? place.join(', ') : null
  })
}

const ipv4ToInt = (ip) => ip.split('.').reduce((value, part) => (value << 8) + Number(part), 0) >>> 0
const inV4 = (ip, base, bits) => bits === 0 || ipv4ToInt(ip) >>> (32 - bits) === ipv4ToInt(base) >>> (32 - bits)

// PHP's FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
const V4_RANGES = [
  ['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16], // private
  ['0.0.0.0', 8], ['127.0.0.0', 8], ['169.254.0.0', 16], ['240.0.0.0', 4], // reserved
]

function expandV6(ip) {
  let address = ip.toLowerCase().split('%')[0]
  // A trailing dotted IPv4 part (::ffff:1.2.3.4) becomes two hex groups
  const v4 = address.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) {
    const n = ipv4ToInt(v4[1])
    address = address.replace(v4[1], `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`)
  }
  const [head, tail] = address.includes('::') ? address.split('::') : [address, null]
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const fill = tail === null ? [] : Array(8 - left.length - right.length).fill('0')
  return [...left, ...fill, ...right].map((group) => Number.parseInt(group || '0', 16))
}

function isPrivateOrReserved(ip) {
  if (net.isIPv4(ip)) return V4_RANGES.some(([base, bits]) => inV4(ip, base, bits))
  const g = expandV6(ip)
  const allZeroUntil = (n) => g.slice(0, n).every((part) => part === 0)
  if (allZeroUntil(7) && (g[7] === 0 || g[7] === 1)) return true // :: and ::1
  if (allZeroUntil(5) && g[5] === 0xffff) return true // IPv4-mapped ::ffff:0:0/96
  if ((g[0] & 0xfe00) === 0xfc00) return true // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true // link-local fe80::/10
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // documentation 2001:db8::/32
  return false
}
