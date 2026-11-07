import crypto from 'node:crypto'
import { abort, config } from '../utils/index.js'

/**
 * CHAPA_MODE=fake: stands in for Chapa during local development when no working Chapa key is available. There is no
 * checkout page: starting a checkout counts as paid straight away (Create & Pay), and verify answers the way Chapa's
 * API would for a successful payment. Refused in production, where it would let anyone mark an order as paid.
 *
 * Payments live in memory; after a restart verify finds nothing for older tx_refs, which is fine since those orders
 * were already marked paid when they were created.
 */
const payments = new Map()

function ensureNotProduction() {
  if (config.env === 'production') {
    abort(503, 'CHAPA_MODE=fake is for local development only. Set CHAPA_MODE=test or live with real Chapa keys.')
  }
}

export const fakeChapaClient = {
  /** Records the payment as made; returns no checkout URL, since there is nothing for the person to do */
  async initialize(payload) {
    ensureNotProduction()
    payments.set(payload.tx_ref, payload)
    return null
  },

  async verify(txRef) {
    ensureNotProduction()
    const payload = payments.get(txRef)
    if (!payload) return null
    return {
      status: 'success',
      amount: payload.amount,
      currency: payload.currency,
      tx_ref: txRef,
      reference: `FAKE-${crypto.createHash('md5').update(txRef).digest('hex').slice(0, 10).toUpperCase()}`,
      method: 'test',
    }
  },
}
