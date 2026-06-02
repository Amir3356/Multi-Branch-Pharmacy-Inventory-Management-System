// The store's policy, as the API sends it (server: Policies/Resources/PolicyResource.php)

/**
 * @typedef {object} Policy
 * @property {number} defaultMinStock      fewer units than this at a branch is Low Stock
 * @property {number} expiryWarningDays    a batch expiring within this many days is Expiring Soon
 * @property {string | null} updatedBy     who last saved it
 * @property {string | null} updatedAt     ISO timestamp
 *
 * Sent to PUT /policy
 * @typedef {{ defaultMinStock: number, expiryWarningDays: number }} PolicyPayload
 */

// The longest expiry warning that still makes sense (two years); the server allows the same
export const MAX_WARNING_DAYS = 730

/** @returns {PolicyPayload} */
export const toPolicyPayload = ({ minStock, expiryDays }) => ({ defaultMinStock: minStock, expiryWarningDays: expiryDays })
