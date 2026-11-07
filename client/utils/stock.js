// Stock rules: status comes from quantity; expiry is tracked separately, and the Inventory table's Status shows both
import { todayKey } from './dates'

// What the Inventory table's Status column can show
export const INVENTORY_STATUSES = ['In Stock', 'Low Stock', 'Expiring Soon', 'Expired', 'Out of Stock']

/** In Stock, Low Stock (below the minimum stock level), or Out of Stock (none left) */
export const getStockStatus = (stock, minLevel, settings) => {
  if (stock <= 0) return 'Out of Stock'
  if (settings.lowStockAlerts && stock < minLevel) return 'Low Stock'
  return 'In Stock'
}

/** Past its expiration date (YYYY-MM-DD): from the day after it, in this computer's local time */
export const isExpired = (expiry) => Boolean(expiry) && expiry < todayKey()

/** Whole calendar days from today to an expiry date (YYYY-MM-DD): 0 today, 1 tomorrow, negative once past */
export const daysToExpiry = (expiry) => Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${todayKey()}T00:00:00Z`)) / 86400000)

/** A batch within the expiry warning window (expired ones included). Counted in calendar days, so the result is the
 * same at any time of day. */
export const isExpiringSoon = (expiry, settings) =>
  Boolean(settings.expiryAlerts && expiry) && daysToExpiry(expiry) <= settings.expiryWarningDays

/**
 * The Inventory table's Status: none left wins, then expiry, then quantity. An expired batch stays Expired however
 * many units it has; one inside the warning window (Policy → Expiring Soon) is Expiring Soon until its date passes.
 */
export const getInventoryStatus = (stock, quantityStatus, expiry, settings) => {
  if (stock <= 0) return 'Out of Stock'
  if (isExpired(expiry)) return 'Expired'
  if (isExpiringSoon(expiry, settings)) return 'Expiring Soon'
  return quantityStatus
}

/**
 * Inventory rows: one per batch of a product at a branch, joined with the catalog and stock rules. Empty batches drop
 * out; a product with nothing left at a branch keeps one row (its latest batch) so it shows as Out of Stock. Low Stock
 * and Out of Stock are worked out from the product's total at the branch (productStock), expiry from each batch's own date.
 */
export const buildInventory = (settings, stockLevels, products) => {
  const productStock = new Map()
  for (const e of stockLevels) productStock.set(`${e.medId}-${e.branchId}`, (productStock.get(`${e.medId}-${e.branchId}`) || 0) + Math.max(0, e.stock))
  const shownEmpty = new Set()
  return stockLevels
    .filter((e) => {
      const id = `${e.medId}-${e.branchId}`
      if (e.stock > 0) return true
      if (productStock.get(id) > 0 || shownEmpty.has(id)) return false
      shownEmpty.add(id) // rows are newest first, so this is the latest batch
      return true
    })
    .map((entry) => {
      const product = products.find((m) => m.id === entry.medId)
      const reorderLevel = settings.defaultMinStock
      const total = productStock.get(`${entry.medId}-${entry.branchId}`)
      const status = getStockStatus(total, reorderLevel, settings)
      return {
        ...product,
        ...entry,
        reorderLevel,
        key: `${entry.medId}-${entry.branchId}-${entry.batch}`,
        // Units of this product at the branch across all its batches
        productStock: total,
        // Quantity only (In Stock / Low Stock / Out of Stock), for the product at the branch
        status,
        expiringSoon: isExpiringSoon(entry.expiry, settings),
        expired: isExpired(entry.expiry),
        // What the Status column shows: quantity and expiry together
        inventoryStatus: getInventoryStatus(total, status, entry.expiry, settings)
      }
    })
}

/** Batches in first-in, first-out order: the earliest to arrive first. Expired and empty batches are left out, since
 * they can't be sold or moved. */
export const fifoBatches = (rows) =>
  rows
    .filter((r) => r.stock > 0 && !isExpired(r.expiry))
    .sort((a, b) => (a.receivedAt || '').localeCompare(b.receivedAt || '') || String(a.batch).localeCompare(String(b.batch)))

/** Batches in first-expired, first-out (FEFO) order: the earliest expiration date first, so it is sold before it
 * expires. Batches without an expiry date go last; equal dates fall back to the earliest arrival. Expired and empty
 * batches are left out, since they can't be sold. */
export const fefoBatches = (rows) =>
  rows
    .filter((r) => r.stock > 0 && !isExpired(r.expiry))
    .sort((a, b) =>
      (a.expiry ? 0 : 1) - (b.expiry ? 0 : 1) ||
      (a.expiry || '').localeCompare(b.expiry || '') ||
      (a.receivedAt || '').localeCompare(b.receivedAt || '') ||
      String(a.batch).localeCompare(String(b.batch)))

/** Which batches `qty` units come from under FIFO, e.g. [{ batch: 'BT-00003', qty: 5 }, { batch: 'BT-00007', qty: 2 }];
 * null when the batches don't hold that many units */
export function allocateFifo(rows, qty) {
  const taken = []
  let left = qty
  for (const row of fifoBatches(rows)) {
    if (left <= 0) break
    const units = Math.min(left, row.stock)
    taken.push({ batch: row.batch, qty: units })
    left -= units
  }
  return left > 0 ? null : taken
}

/** Inventory rows grouped into one entry per product at a branch, with the units that can still be sold or moved
 * (not expired) and its batches. For pickers that list each product once. */
export function productsInStock(inventoryRows) {
  const byProduct = new Map()
  for (const row of inventoryRows) {
    const id = `${row.medId}-${row.branchId}`
    const entry = byProduct.get(id) || { ...row, key: id, batches: [] }
    entry.batches.push(row)
    byProduct.set(id, entry)
  }
  return [...byProduct.values()]
    .map((p) => ({ ...p, stock: fifoBatches(p.batches).reduce((units, b) => units + b.stock, 0) }))
    .filter((p) => p.stock > 0)
}
