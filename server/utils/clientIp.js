import net from 'node:net'

/**
 * Turns a raw address into a clean IP for storage and display, or null when it isn't a real IP.
 * - IPv4-mapped IPv6 ("::ffff:192.168.1.5") becomes plain IPv4 ("192.168.1.5")
 * - IPv6 zone ids ("fe80::1%eth0") are dropped
 * - Anything that isn't a valid IP (forged headers, junk) is rejected, so it can never overflow the
 *   varchar(45) ip_address columns or show nonsense in Session Monitoring and the Audit Log
 */
export function normalizeIp(value) {
  if (typeof value !== 'string') return null
  let ip = value.trim()
  if (!ip || ip.length > 64) return null

  // "[2001:db8::1]" → "2001:db8::1"
  if (ip.startsWith('[') && ip.includes(']')) ip = ip.slice(1, ip.indexOf(']'))
  ip = ip.split('%')[0]

  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (mapped) ip = mapped[1]

  // IPv6 loopback ("::1", also written 0:0:0:0:0:0:0:1) is the same machine as 127.0.0.1; show the familiar form
  if (net.isIPv6(ip) && /^[0:]*1$/.test(ip)) ip = '127.0.0.1'

  return net.isIP(ip) ? ip.toLowerCase() : null
}

/**
 * The visitor's IP. Uses Express's req.ip, which reads X-Forwarded-For only from proxies listed in
 * TRUSTED_PROXIES, so a visitor can't fake their address by sending that header themselves.
 */
export function clientIpOf(req) {
  return normalizeIp(req.ip) ?? normalizeIp(req.socket?.remoteAddress) ?? null
}
