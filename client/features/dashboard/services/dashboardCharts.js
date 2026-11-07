import { toDateKey } from '../../../utils'
import { INVENTORY_STATUSES } from '../../../utils/stock'
import { EXPENSE_CATEGORIES } from '../../expenses/model/expense'
import { inPeriod } from './periods'

// The Inventory Officer's dashboard charts, worked out from the same branch data as the cards.
// Stock charts show the shelf right now; Expenses and Damage follow the chosen period.

const sum = (list, fn) => list.reduce((total, item) => total + fn(item), 0)
const day = (key) => new Date(`${key}T00:00:00`)
const short = (key, opts) => day(key).toLocaleDateString('en-US', opts)

/** Splits [from, to] into chart columns: days up to a month, weeks up to ~4 months, months beyond */
export function periodBuckets([from, to]) {
  const days = Math.round((day(to) - day(from)) / 86400000) + 1
  const buckets = []
  // A range over more than one year shows the year on month labels
  const monthFormat = from.slice(0, 4) === to.slice(0, 4) ? { month: 'short' } : { month: 'short', year: '2-digit' }
  if (days <= 31 || days > 120) {
    const byMonth = days > 120
    const cursor = day(from)
    while (toDateKey(cursor) <= to) {
      const start = toDateKey(cursor)
      if (byMonth) cursor.setMonth(cursor.getMonth() + 1, 1)
      else cursor.setDate(cursor.getDate() + 1)
      cursor.setDate(cursor.getDate() - 1)
      const end = toDateKey(cursor) < to ? toDateKey(cursor) : to
      cursor.setDate(cursor.getDate() + 1)
      buckets.push({ from: start, to: end, label: byMonth ? short(start, monthFormat) : short(start, { month: 'short', day: 'numeric' }) })
    }
    return buckets
  }
  const cursor = day(from)
  while (toDateKey(cursor) <= to) {
    const start = toDateKey(cursor)
    cursor.setDate(cursor.getDate() + 6)
    const end = toDateKey(cursor) < to ? toDateKey(cursor) : to
    cursor.setDate(cursor.getDate() + 1)
    buckets.push({ from: start, to: end, label: short(start, { month: 'short', day: 'numeric' }) })
  }
  return buckets
}

/** How many inventory batches are in each status */
export const stockStatusBreakdown = (inventory) =>
  INVENTORY_STATUSES.map((status) => ({ label: status, value: inventory.filter((i) => i.inventoryStatus === status).length }))

/** Products with the fewest units on hand (all batches of a product together), lowest first */
export function lowestStock(inventory, limit = 8) {
  const byProduct = new Map()
  for (const i of inventory) byProduct.set(i.name, (byProduct.get(i.name) || 0) + Math.max(0, i.stock))
  return [...byProduct].map(([label, value]) => ({ label, value })).sort((a, b) => a.value - b.value || a.label.localeCompare(b.label)).slice(0, limit)
}

/** Expenses and damage loss (both money) per column of the period */
export const spendingOverTime = ({ expenses, damaged }, range) =>
  periodBuckets(range).map((b) => ({
    label: b.label,
    title: b.from === b.to ? b.from : `${b.from} – ${b.to}`,
    values: [
      sum(expenses.filter((e) => inPeriod(e.date, [b.from, b.to])), (e) => e.amount),
      sum(damaged.filter((d) => inPeriod(d.date, [b.from, b.to])), (d) => d.lossValue || 0)
    ]
  }))

/** Money spent per expense category in the period, largest first; every category is listed, even at 0 */
export function expensesByCategory(expenses, range) {
  const totals = new Map(EXPENSE_CATEGORIES.map((c) => [c, 0]))
  for (const e of expenses.filter((x) => inPeriod(x.date, range))) totals.set(e.category, (totals.get(e.category) || 0) + e.amount)
  return [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

// The Purchase Officer's chart

/** Paid order totals (money) per column of the period, by order date */
export const purchasesOverTime = (purchases, range) =>
  periodBuckets(range).map((b) => ({
    label: b.label,
    title: b.from === b.to ? b.from : `${b.from} – ${b.to}`,
    values: [sum(purchases.filter((p) => p.status === 'Paid' && inPeriod(p.date, [b.from, b.to])), (p) => p.total)]
  }))

// The Cashier's charts

/** Sales totals (money) per column of the period */
export const salesOverTime = (sales, range) =>
  periodBuckets(range).map((b) => ({
    label: b.label,
    title: b.from === b.to ? b.from : `${b.from} – ${b.to}`,
    values: [sum(sales.filter((s) => inPeriod(s.date, [b.from, b.to])), (s) => s.total)]
  }))

/** Pie slices for the products that brought in the most money in the period, largest first, with the units sold;
 * beyond the top `limit - 1`, the rest are added together as "Other" */
export function topSellingSlices(sales, range, limit = PIE_TONES.length) {
  const byProduct = new Map()
  for (const s of sales.filter((x) => inPeriod(x.date, range))) {
    const row = byProduct.get(s.product) || { label: s.product, value: 0, qty: 0 }
    row.value += s.total
    row.qty += s.qty
    byProduct.set(s.product, row)
  }
  return topSlices([...byProduct.values()], limit)
}

/** The largest `limit - 1` rows as they are, the rest added together as "Other (n products)" */
export function topSlices(rows, limit = PIE_TONES.length) {
  const ranked = [...rows].sort((a, b) => b.value - a.value)
  if (ranked.length <= limit) return ranked
  const rest = ranked.slice(limit - 1)
  return [...ranked.slice(0, limit - 1), { label: `Other (${rest.length} products)`, value: sum(rest, (r) => r.value), qty: sum(rest, (r) => r.qty), other: true }]
}

// Pie slice colours, in a fixed order checked with the dataviz palette validator on the white card: every neighbour,
// including the last slice next to the first, is told apart with normal and colour-blind vision. Slots 1-4 are the
// role colours the other charts use. A pie shows at most this many products; the rest fold into a grey "Other".
export const PIE_TONES = ['role-1', 'role-2', 'role-3', 'role-4', 'role-5', 'role-6', 'role-7']

/** A slice's colour: its place in the fixed order, or neutral grey for "Other" */
export const sliceTone = (slice, index) => (slice.other ? 'slate' : PIE_TONES[index])

// The Owner's chart

/** Sales, purchases and expenses per column of the period, from the server's per-day totals */
export const moneyOverTime = (daily, range) =>
  periodBuckets(range).map((b) => {
    const days = daily.filter((d) => inPeriod(d.date, [b.from, b.to]))
    return {
      label: b.label,
      title: b.from === b.to ? b.from : `${b.from} – ${b.to}`,
      values: [sum(days, (d) => d.sales), sum(days, (d) => d.purchases), sum(days, (d) => d.expenses)]
    }
  })
