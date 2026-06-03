import { iso8601 } from '../utils/index.js'
import { localDate } from '../utils/time.js'
import { capitalize } from '../utils/helpers.js'

// A purchase order bought (and already paid for) for a branch; its Inventory Officer then adds the stock
export const TABLE = 'procurements'
export const ID_PREFIX = 'PO'
// The model name Laravel's 404 message carries
export const MODEL_CLASS = 'App\\Features\\Procurements\\Models\\Procurement'
// The currencies an order can be recorded in
export const CURRENCIES = ['ETB', 'USD']
// The unique constraint that makes an idempotency key count once per Purchase Officer
export const IDEMPOTENCY_CONSTRAINT = 'procurements_created_by_idempotency_key_unique'
// The columns update() may change
export const UPDATABLE_COLUMNS = new Set(['received_at', 'received_by', 'batch', 'expiry_date'])

/** Paid, and its Inventory Officer hasn't added the stock yet */
export const awaitsReceipt = (procurement) => procurement.status === 'paid' && procurement.received_at === null

/** ProcurementResource: shaped like the React app's purchase rows */
export function toResource(p) {
  return {
    id: p.id,
    branchId: p.branch_id,
    supplier: p.supplier,
    category: p.category,
    product: p.product,
    medId: p.med_id,
    qty: p.qty,
    purchasePrice: Number(p.unit_price),
    total: Number(p.total),
    currency: p.currency,
    date: localDate(p.created_at),
    // When the order was placed, to the second (the Procurement table shows its time under the date)
    createdAt: iso8601(p.created_at),
    status: capitalize(p.status),
    // Set when the receiving branch's Inventory Officer added the stock (Receive Stock); until then it isn't in stock
    receivedAt: iso8601(p.received_at),
    // The batch number generated when the stock was added (older orders: their procurement ID)
    batch: p.batch,
    expiryDate: p.expiry_date ?? null,
  }
}
