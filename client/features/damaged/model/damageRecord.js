// A write-off, as the API sends it (server: DamagedItems/Resources/DamagedItemResource.php)

/**
 * @typedef {object} DamageRecord
 * @property {string} id                 e.g. "DMG-00001"
 * @property {string} branchId
 * @property {string | null} medId
 * @property {string} product
 * @property {string} category
 * @property {string} batch
 * @property {number} qty
 * @property {string} reason             one of DAMAGE_REASONS
 * @property {number} lossValue          units × the product's purchase price, worked out by the server
 * @property {string} date               YYYY-MM-DD it was written off
 * @property {string | null} recordedBy
 *
 * Sent to POST /damaged-items (the branch is the officer's own)
 * @typedef {{ medId: string, product: string, category: string, batch: string, qty: number, reason: string }} DamagePayload
 */

// Why stock is written off (the server accepts the same list)
export const DAMAGE_REASONS = [
  'Broken / crushed packaging',
  'Water damage',
  'Contaminated',
  'Temperature damage (cold chain)',
  'Defective item',
  'Other'
]

/** @returns {DamagePayload} */
export const toDamagePayload = ({ medId, product, category, batch, qty, reason }) => ({ medId, product, category, batch, qty, reason })
