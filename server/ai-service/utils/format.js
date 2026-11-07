/** "ETB 1,234.50" for audit descriptions (Laravel's AuditLogger::money) */
export function money(amount, currency = 'ETB') {
  const value = Number(amount ?? 0)
  return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "Chrome on Linux" from a browser's user agent (stored as the session name and in the audit log) */
export function describeDevice(userAgent) {
  const ua = String(userAgent ?? '')
  const browser = ua.includes('Edg/') ? 'Edge' : ua.includes('Firefox/') ? 'Firefox' : ua.includes('Chrome/') ? 'Chrome' : ua.includes('Safari/') ? 'Safari' : 'Browser'
  const os = ua.includes('Windows')
    ? 'Windows'
    : ua.includes('Android')
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : ua.includes('Mac OS')
          ? 'macOS'
          : ua.includes('Linux')
            ? 'Linux'
            : 'Unknown OS'
  return `${browser} on ${os}`
}

/** Laravel's Str::limit($value, $limit, '…'): cuts to `limit` characters, adding the end marker when cut */
export function limit(value, max, end = '...') {
  const text = String(value ?? '')
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}${end}`
}

/** Lower-case product name: how stock batches, sales, transfers and damaged items find the same product */
export const productKey = (name) => String(name ?? '').trim().toLowerCase()

/** "1 unit" / "3 units" */
export const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`
