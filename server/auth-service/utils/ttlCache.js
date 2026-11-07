/**
 * Laravel's Cache::remember for this service's memory: a value is kept until it expires; null is never kept, so a
 * failed lookup is tried again next time (as Laravel's remember did).
 */
export class TtlCache {
  #entries = new Map()

  constructor(ttlMs, maxEntries = 10_000) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
  }

  async remember(key, compute) {
    const entry = this.#entries.get(key)
    if (entry && entry.expiresAt > Date.now()) return entry.value
    const value = await compute()
    if (value !== null && value !== undefined) {
      if (this.#entries.size >= this.maxEntries) this.#entries.delete(this.#entries.keys().next().value)
      this.#entries.set(key, { value, expiresAt: Date.now() + this.ttlMs })
    }
    return value ?? null
  }
}
