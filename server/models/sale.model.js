import { localDate } from '../utils/time.js'
import { capitalize } from '../utils/helpers.js'

// A sale recorded by a Cashier at their branch; its units leave stock through inventory-service
export const TABLE = 'sales'
export const ID_PREFIX = 'SL'
export const STATUS_PAID = 'paid'
// The unique index that makes an idempotency key count once per cashier
export const IDEMPOTENCY_CONSTRAINT = 'sales_sold_by_idempotency_key_unique'

/** SaleResource. `sale.seller_name` is the seller's full name (null once the account is deleted). */
export function toResource(sale) {
  const createdAtIso = sale.created_at
    ? (sale.created_at instanceof Date ? sale.created_at.toISOString() : new Date(sale.created_at).toISOString())
    : null
  return {
    id: sale.id,
    branchId: sale.branch_id,
    customer: sale.customer,
    category: sale.category,
    product: sale.product,
    medId: sale.med_id,
    qty: sale.qty,
    // [{ batch, qty }] first in, first out; empty for sales recorded before batches were kept
    batches: sale.batches ?? [],
    unitPrice: Number(sale.unit_price),
    total: Number(sale.total),
    status: capitalize(sale.status),
    date: localDate(sale.created_at),
    createdAt: createdAtIso,
    time: createdAtIso ? new Date(createdAtIso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : null,
    soldBy: sale.seller_name ?? null,
  }
}
