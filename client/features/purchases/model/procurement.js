// A procurement (purchase order paid through Chapa), as the API sends it (server: Procurements/Resources/ProcurementResource.php)

/**
 * @typedef {object} Procurement
 * @property {string} id                 e.g. "PO-00001"
 * @property {string} branchId
 * @property {string} supplier
 * @property {string} category
 * @property {string} product
 * @property {string | null} medId       null for a product new to the catalog
 * @property {number} qty
 * @property {number} purchasePrice      per unit
 * @property {number} total
 * @property {'ETB' | 'USD'} currency
 * @property {string} date               YYYY-MM-DD
 * @property {string | null} createdAt  when it was placed (ISO 8601); its time shows under Purchased On
 * @property {'Pending' | 'Paid' | 'Failed'} status
 * @property {string | null} receivedAt  when the branch's Inventory Officer added the stock (Receive Stock); until then
 *                                       a paid order is not in stock and its delivery is Pending
 * @property {string | null} batch       the batch number generated when it was added to stock (BT-00001, …)
 * @property {string | null} expiryDate  its expiration date (YYYY-MM-DD), entered with the batch
 *
 * Sent to POST /procurements
 * @typedef {object} ProcurementPayload
 * @property {string} branchId
 * @property {string} supplier
 * @property {string} category
 * @property {string} product
 * @property {string} [medId]
 * @property {number} qty
 * @property {number} totalCost          the whole order; the server derives the unit price (totalCost ÷ qty)
 * @property {'ETB' | 'USD'} currency
 */

export const EMPTY_PURCHASE_FORM = { branchId: '', supplier: '', category: '', medId: '', qty: '', totalCost: '' }

/** The unit purchase price a Total Cost works out to, or null until both numbers are valid */
export const unitPriceFrom = (totalCost, qty) => (Number.isInteger(qty) && qty > 0 && totalCost > 0 ? Math.round((totalCost / qty) * 100) / 100 : null)

/** @returns {Omit<ProcurementPayload, 'currency'>} the order from the form; the currency is added from settings */
export const toProcurementPayload = (form, product, qty, totalCost) => ({
  branchId: form.branchId,
  supplier: form.supplier.trim(),
  category: product.category,
  product: product.name,
  medId: product.id,
  totalCost: Math.round(totalCost * 100) / 100,
  qty
})

/** The batch number a procurement's stock arrived under: the generated one, else (older orders) its ID */
export const procurementBatch = (procurement) => procurement.batch || procurement.id

/** Delivery for the Purchase Officer: Pending until the receiving branch adds the stock, then Arrived */
export const deliveryStatus = (procurement) => (procurement.status !== 'Paid' ? null : procurement.receivedAt ? 'Arrived' : 'Pending')
