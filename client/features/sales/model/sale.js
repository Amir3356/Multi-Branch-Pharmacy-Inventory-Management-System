// A sale, as the API sends it (server: Sales/Resources/SaleResource.php)

/**
 * @typedef {object} Sale
 * @property {string} id              e.g. "SL-00001"
 * @property {string} branchId
 * @property {string} customer        "Walk-in Customer" when none was given
 * @property {string} category
 * @property {string} product
 * @property {string | null} medId
 * @property {number} qty
 * @property {number} unitPrice
 * @property {number} total
 * @property {'Paid'} status
 * @property {string} date            YYYY-MM-DD
 * @property {string | null} soldBy
 * @property {{ batch: string, qty: number }[]} batches  the batches the units came from, first-in first-out
 *
 * Sent to POST /sales (the server works out the total)
 * @typedef {{ branchId: string, customer: string, category: string, product: string, medId?: string, qty: number, unitPrice: number, batches: { batch: string, qty: number }[] }} SalePayload
 */

/** @returns {SalePayload} */
export const toSalePayload = ({ branchId, customer, category, product, medId, qty, unitPrice, batches }) => ({ branchId, customer, category, product, medId, qty, unitPrice, batches })
