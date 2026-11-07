import { todayKey } from '../../../utils'
import { inPeriod } from './periods'

// Each role's dashboard: summary cards worked out from the app's own data, for the branch in scope.
// Cards are { title, icon, tone, value, chip, chipTone }; `icon` is a key the page maps to an icon.

const sum = (list, fn) => list.reduce((total, item) => total + fn(item), 0)
const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`

// Total Sales and Quantity Sold follow the chosen period; Today's Sales is always today
function cashierCards({ sales }, { money, today, period }) {
  const salesInPeriod = sales.filter((s) => inPeriod(s.date, period.range))
  const salesToday = sales.filter((s) => s.date === today)
  return [
    { title: 'Total Sales', icon: 'receipt', tone: 'teal', value: money(sum(salesInPeriod, (s) => s.total)), chip: `${plural(salesInPeriod.length, 'transaction', 'transactions')} · ${period.name}`, chipTone: 'positive' },
    { title: "Today's Sales", icon: 'sales', tone: 'cyan', value: money(sum(salesToday, (s) => s.total)), chip: `${plural(salesToday.length, 'transaction', 'transactions')} today` },
    { title: 'Quantity Sold', icon: 'stock', tone: 'warning', value: sum(salesInPeriod, (s) => s.qty).toLocaleString(), chip: `${plural(sum(salesToday, (s) => s.qty), 'unit', 'units')} today` }
  ]
}

// Stock cards show the shelf right now; Damaged and Expenses follow the chosen period
function inventoryOfficerCards({ inventory, purchases, incomingTransfers = [], damaged, expenses = [] }, { money, settings, period }) {
  const inStock = inventory.filter((i) => i.stock > 0)
  // Inventory has a row per batch: count each product once
  const productsWith = (rows) => new Set(rows.map((i) => i.medId)).size
  // Paid for this branch, or sent here by another branch, but not added with Receive Stock yet, so not in stock
  const waiting = [...purchases.filter((p) => p.status === 'Paid' && !p.receivedAt), ...incomingTransfers.filter((t) => t.status === 'Pending')]
  const damagedInPeriod = damaged.filter((d) => inPeriod(d.date, period.range))
  const expensesInPeriod = expenses.filter((e) => inPeriod(e.date, period.range))
  // group: 'stock' cards show the shelf right now, 'period' cards follow the chosen period; wide cards span two columns
  return [
    { group: 'stock', title: 'Products in Stock', icon: 'stock', tone: 'teal', value: productsWith(inStock), chip: plural(sum(inStock, (i) => i.stock), 'unit on hand', 'units on hand') },
    { group: 'stock', wide: true, title: 'Stock Value', icon: 'money', tone: 'cyan', value: money(sum(inventory, (i) => i.stock * (i.purchasePrice || 0))), chip: `Selling value ${money(sum(inventory, (i) => i.stock * (i.sellingPrice || 0)))}`, chipTone: 'positive' },
    { group: 'stock', title: 'Waiting to Add', icon: 'procurement', tone: 'warning', value: waiting.length, chip: waiting.length ? `${plural(sum(waiting, (p) => p.qty), 'unit', 'units')} · use Receive Stock` : 'Nothing waiting', chipTone: waiting.length ? 'negative' : 'neutral' },
    { group: 'stock', title: 'Low Stock', icon: 'low', tone: 'warning', value: productsWith(inStock.filter((i) => i.status === 'Low Stock')), chip: `Below ${settings.defaultMinStock} units`, chipTone: 'negative' },
    { group: 'stock', title: 'Expiring Soon', icon: 'clock', tone: 'warning', value: inventory.filter((i) => i.inventoryStatus === 'Expiring Soon').length, chip: `Within ${settings.expiryWarningDays} days`, chipTone: 'negative' },
    { group: 'stock', title: 'Expired', icon: 'expired', tone: 'danger', value: inStock.filter((i) => i.expired).length, chip: 'Must not be sold', chipTone: 'negative' },
    { group: 'stock', title: 'Out of Stock', icon: 'empty', tone: 'danger', value: inventory.filter((i) => i.stock <= 0).length, chip: 'Ask for a restock', chipTone: 'negative' },
    { group: 'period', title: 'Damaged', icon: 'damaged', tone: 'danger', value: plural(sum(damagedInPeriod, (d) => d.qty), 'unit', 'units'), chip: `Loss ${money(sum(damagedInPeriod, (d) => d.lossValue))} · ${period.name}`, chipTone: 'negative' },
    { group: 'period', title: 'Expenses', icon: 'wallet', tone: 'warning', value: money(sum(expensesInPeriod, (e) => e.amount)), chip: `${plural(expensesInPeriod.length, 'expense', 'expenses')} · ${period.name}`, chipTone: 'negative' }
  ]
}

// Total Purchases follows the chosen period (paid orders, by order date); Awaiting Delivery is every paid order not in stock yet
function procurementOfficerCards({ purchases }, { money, period }) {
  const paid = purchases.filter((p) => p.status === 'Paid' && inPeriod(p.date, period.range))
  const undelivered = purchases.filter((p) => p.status === 'Paid' && !p.receivedAt)
  return [
    { title: 'Total Purchases', icon: 'money', tone: 'teal', value: money(sum(paid, (p) => p.total)), chip: `${plural(paid.length, 'paid order', 'paid orders')} · ${period.name}`, chipTone: 'positive' },
    { title: 'Awaiting Delivery', icon: 'truck', tone: 'cyan', value: undelivered.length, chip: undelivered.length ? `${plural(sum(undelivered, (p) => p.qty), 'unit', 'units')} not added to stock yet` : 'Every paid order is in stock', chipTone: 'neutral' }
  ]
}

// From the server's summary: 'period' cards follow the chosen period, 'now' cards are the current state
function ownerCards({ totals, now }, { money, period }) {
  const profitable = totals.netProfit >= 0
  return [
    { group: 'period', title: 'Revenue', icon: 'sales', tone: 'teal', value: money(totals.sales), chip: `${plural(totals.salesCount, 'sale', 'sales')} · ${plural(totals.unitsSold, 'unit', 'units')}`, chipTone: 'positive' },
    { group: 'period', title: 'Total Purchases', icon: 'procurement', tone: 'cyan', value: money(totals.purchases), chip: `${plural(totals.purchasesCount, 'paid order', 'paid orders')} · ${period.name}` },
    { group: 'period', title: 'Total Expenses', icon: 'wallet', tone: 'warning', value: money(totals.expenses), chip: `${plural(totals.expensesCount, 'expense', 'expenses')} · ${period.name}`, chipTone: 'negative' },
    { group: 'period', title: 'Damage Loss', icon: 'damaged', tone: 'danger', value: money(totals.damageLoss), chip: `${plural(totals.damagedUnits, 'unit', 'units')} written off · ${period.name}`, chipTone: totals.damageLoss ? 'negative' : 'neutral' },
    // A loss shows as Net Loss with the amount lost, rather than a negative profit
    { group: 'period', title: profitable ? 'Net Profit (est.)' : 'Net Loss (est.)', icon: 'money', tone: profitable ? 'teal' : 'danger', value: money(Math.abs(totals.netProfit)), hint: 'Revenue − what the sold items cost to buy − Total Expenses − Damage Loss. Estimated: each item is costed at its latest purchase price.', chip: `Cost of items sold ${money(totals.costOfSales)}`, chipTone: profitable ? 'positive' : 'negative' },
    { group: 'now', title: 'Active Branches', icon: 'branch', tone: 'cyan', value: now.activeBranches, chip: `${now.totalBranches} in total` },
    { group: 'now', title: 'Active Staff', icon: 'staff', tone: 'teal', value: now.activeStaff, chip: now.invitedStaff ? `${plural(now.invitedStaff, 'invitation', 'invitations')} not accepted yet` : 'Every invitation accepted', chipTone: now.invitedStaff ? 'negative' : 'positive' }
  ]
}

const CARDS_BY_ROLE = {
  owner: ownerCards,
  inventory_officer: inventoryOfficerCards,
  cashier: cashierCards,
  purchase_officer: procurementOfficerCards
}

/** The cards for a role. `data` lists are already narrowed to the branch in scope; `period` is { range: [from, to], name }. */
export function dashboardCards(role, data, { money, settings, period }) {
  const today = todayKey()
  return (CARDS_BY_ROLE[role] || (() => []))(data, { money, settings, period, today, month: today.slice(0, 7) })
}

// The Inventory Officer's to-do list: stock rows to act on, most urgent first
const ATTENTION_ORDER = { Expired: 0, 'Out of Stock': 1, 'Expiring Soon': 2, 'Low Stock': 3 }
const ATTENTION_ACTION = {
  Expired: 'Take it off the shelf and record it as damaged',
  'Out of Stock': 'Ask the Purchase Officer for a restock',
  'Expiring Soon': 'Sell it first or move it to another branch',
  'Low Stock': 'Ask the Purchase Officer for a restock'
}

export const needsAttention = (inventory) =>
  inventory
    .filter((i) => i.inventoryStatus in ATTENTION_ORDER)
    .map((i) => ({ ...i, action: ATTENTION_ACTION[i.inventoryStatus] }))
    .sort((a, b) => ATTENTION_ORDER[a.inventoryStatus] - ATTENTION_ORDER[b.inventoryStatus] || (a.expiry || '').localeCompare(b.expiry || ''))
