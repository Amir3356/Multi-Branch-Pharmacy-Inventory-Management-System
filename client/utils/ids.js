// Next sequential id for a list of records, e.g. SL-5011 → SL-5012, ACC-004 → ACC-005
export const nextId = (records, prefix, pad = 0) => {
  const next = Math.max(0, ...records.map((r) => Number(String(r.id).split('-')[1]) || 0)) + 1
  return `${prefix}-${pad ? String(next).padStart(pad, '0') : next}`
}

/** A random UUID (v4) for an Idempotency-Key. crypto.randomUUID only exists on HTTPS and localhost, so a plain-HTTP
 * address on the store's network builds one from crypto.getRandomValues instead. */
export const newIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
