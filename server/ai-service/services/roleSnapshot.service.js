import { DateTime, config, productKey, roleLabel } from '../utils/index.js'
import { dbTime, groupBy, phpRound, sortBy, sortByDesc, sum, toFloat, toInt, truthy } from '../utils/php.js'
import { DAYS, LIST_LIMIT } from '../models/roleSnapshot.model.js'
import { currentPolicy } from '../repositories/policy.repository.js'
import * as roleSnapshotRepository from '../repositories/roleSnapshot.repository.js'
import { buildForecast } from './forecaster.service.js'
import { summary } from './ownerDashboard.service.js'

/**
 * The figures one role's AI Assistance works from: only what that role may see in the app, and only its own branch
 * for branch staff. No customer or staff names are included, since this is sent to an outside AI service.
 * Reads other services' tables (stock, sales, procurements, transfers, expenses, damaged items) read-only.
 */
// Product names match ignoring case and surrounding spaces (PHP's mb_strtolower(trim()))
const same = (a, b) => productKey(a) === productKey(b)
// substr((string) $timestamp, 0, 10): the UTC date of a timestamp column, '' for null
const utcDay = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10))

export async function snapshotFor(user) {
  const zone = config.timezone
  const today = DateTime.now().setZone(zone).startOf('day')
  const policy = await currentPolicy()
  const [branchRows, priceRows, batchRows] = await Promise.all([
    roleSnapshotRepository.branches(),
    roleSnapshotRepository.productCosts(),
    roleSnapshotRepository.stockBatches(),
  ])

  const s = {
    zone,
    today,
    minStock: policy.default_min_stock,
    warningDays: policy.expiry_warning_days,
    branches: new Map(branchRows.map((b) => [b.id, b])),
    // pluck('purchase_price', 'name') then by lower-case name: a later product with the same name wins
    costs: new Map(priceRows.map((p) => [productKey(p.name), toFloat(p.purchase_price)])),
    stock: stockByProduct(batchRows),
  }

  const branchId = user.coversAllBranches ? null : user.branchId
  const context = {
    role: roleLabel(user.role),
    scope: truthy(branchId) ? `Branch ${branchName(s, branchId)}` : 'All branches',
    today: today.toISODate(),
    currency: 'ETB',
    policy: { minimumStockUnits: s.minStock, expiryWarningDays: s.warningDays },
    recentPeriod: `last ${DAYS} days`,
  }

  const roles = { owner, inventory_officer: inventoryOfficer, cashier, purchase_officer: procurementOfficer }
  // Branch staff always have a branch; PHP failed (500) for one without, and so does this
  if (user.role !== 'owner' && user.role !== 'purchase_officer' && !branchId) throw new Error(`The ${user.role} has no branch for the AI snapshot.`)
  return { ...context, ...(await roles[user.role](s, branchId)) }
}

// ---- Roles ----

async function owner(s) {
  const [from, to] = [s.today.minus({ days: DAYS - 1 }).toISODate(), s.today.toISODate()]
  const [prevFrom, prevTo] = [s.today.minus({ days: 2 * DAYS - 1 }).toISODate(), s.today.minus({ days: DAYS }).toISODate()]
  const now = await summary(from, to, null)
  const before = (await summary(prevFrom, prevTo, null)).totals
  const pick = ['sales', 'purchases', 'expenses', 'damageLoss', 'grossProfit', 'netProfit']

  return {
    totals: now.totals,
    // array_intersect_key keeps $before's key order
    previousPeriodTotals: Object.fromEntries(Object.entries(before).filter(([key]) => pick.includes(key))),
    branches: now.branches.map(({ id, ...b }) => ({ ...b, ...stockHealth(s, s.stock.filter((p) => p.branchId === id)) })),
    topProducts: now.topProducts.slice(0, 10),
    stockAtRisk: stockAtRisk(s),
    staffAndPayments: now.now,
    expensesByCategory: await expensesByCategory(s, null),
    damageByReason: await damageByReason(s, null),
    // Calculated forecasts and recommendations (the AI explains them rather than predicting itself)
    forecast: await buildForecast(s.minStock),
  }
}

async function inventoryOfficer(s, branchId) {
  const stock = s.stock.filter((p) => p.branchId === branchId)
  const velocityHere = await velocity(s, branchId)
  const awaiting = await roleSnapshotRepository.paidAwaitingReceiving(branchId)

  return {
    stockHealth: stockHealth(s, stock),
    outOfStock: outOfStock(s, stock, velocityHere),
    lowStock: lowStock(s, stock, velocityHere),
    expiredBatches: expiryList(s, stock, true),
    expiringSoonBatches: expiryList(s, stock, false),
    slowMovers: slowMovers(s, stock, velocityHere),
    transferOptions: transferOptions(s, branchId, stock),
    transfersInTransit: {
      incoming: await transfersInTransit(s, 'to_branch_id', branchId),
      outgoing: await transfersInTransit(s, 'from_branch_id', branchId),
    },
    paidOrdersAwaitingReceiving: awaiting.map((p) => ({ product: p.product, qty: toInt(p.qty), paidOn: utcDay(p.paid_at) })),
    damageByReason: await damageByReason(s, branchId),
    expensesByCategory: await expensesByCategory(s, branchId),
  }
}

async function cashier(s, branchId) {
  const since = (day) => dbTime(day.toUTC())
  const stock = s.stock.filter((p) => p.branchId === branchId)
  const velocityHere = await velocity(s, branchId)
  const total = async (from, to = null) => {
    const row = (await roleSnapshotRepository.salesTotals(branchId, from, to))[0]
    return { amount: toFloat(row.amount), count: toInt(row.count), units: toInt(row.units) }
  }
  const t = s.today
  const [today, yesterday, last7Days, previous7Days, byHour] = await Promise.all([
    total(since(t)),
    total(since(t.minus({ days: 1 })), since(t)),
    total(since(t.minus({ days: 6 }))),
    total(since(t.minus({ days: 13 })), since(t.minus({ days: 6 }))),
    roleSnapshotRepository.salesByHour(s.zone, branchId, since(t.minus({ days: DAYS - 1 }))),
  ])

  return {
    sales: { today, yesterday, last7Days, previous7Days },
    salesByHour: byHour.map((h) => ({ hour: toInt(h.hour), count: toInt(h.count), amount: toFloat(h.amount) })),
    topProducts: sortByDesc([...velocityHere.values()], 'revenue')
      .slice(0, 10)
      .map((v) => ({ product: v.product, units: v.units, revenue: v.revenue })),
    outOfStockButInDemand: outOfStock(s, stock, velocityHere).filter((p) => p.unitsSoldRecently > 0),
    lowStockBestSellers: lowStock(s, stock, velocityHere).filter((p) => p.avgDailySales > 0),
    expiringSoonInStock: expiryList(s, stock, false),
    expiredStillOnShelf: expiryList(s, stock, true),
  }
}

async function procurementOfficer(s) {
  const reorder = []
  for (const branch of s.branches.values()) {
    const velocityHere = await velocity(s, branch.id)
    const here = s.stock.filter((p) => p.branchId === branch.id)
    for (const item of [...outOfStock(s, here, velocityHere), ...lowStock(s, here, velocityHere)]) {
      const monthNeed = Math.ceil(item.avgDailySales * DAYS)
      reorder.push({
        branch: branch.name,
        ...item,
        onOrder: await onOrder(branch.id, item.product),
        suggestedQty: Math.max(0, Math.max(s.minStock * 2, monthNeed) - (item.stock ?? 0)),
        availableAtOtherBranches: surplusElsewhere(s, branch.id, item.product, s.stock),
      })
    }
  }
  reorder.sort((a, b) => b.avgDailySales - a.avgDailySales)

  const since = dbTime(s.today.minus({ days: 180 }).toUTC())
  const recent = dbTime(s.today.minus({ days: DAYS - 1 }).toUTC())
  const [awaitingPayment, notReceived, supplierPrices, spend] = await Promise.all([
    roleSnapshotRepository.ordersAwaitingPayment(),
    roleSnapshotRepository.paidNotReceived(),
    roleSnapshotRepository.supplierPrices(since),
    roleSnapshotRepository.paidSpendSince(recent),
  ])

  return {
    reorderCandidates: reorder.slice(0, 25),
    ordersAwaitingPayment: awaitingPayment.map((p) => ({
      branch: branchName(s, p.branch_id),
      supplier: p.supplier,
      product: p.product,
      qty: toInt(p.qty),
      total: toFloat(p.total),
      status: p.status,
      orderedOn: utcDay(p.created_at),
    })),
    paidNotYetReceived: notReceived.map((p) => ({ branch: branchName(s, p.branch_id), supplier: p.supplier, product: p.product, qty: toInt(p.qty), paidOn: utcDay(p.paid_at) })),
    supplierPrices: supplierPrices.map((r) => ({
      product: r.product,
      supplier: r.supplier,
      avgUnitPrice: toFloat(r.avg_price),
      bestUnitPrice: toFloat(r.best_price),
      orders: toInt(r.orders),
      lastOrder: utcDay(r.last_order),
    })),
    spendLast30Days: { paid: toFloat(spend[0].paid), orders: toInt(spend[0].orders) },
    stockHealthByBranch: [...s.branches.values()].map((b) => ({ branch: b.name, ...stockHealth(s, s.stock.filter((p) => p.branchId === b.id)) })),
  }
}

// ---- Stock ----

/** One entry per product at a branch: total units (empty batches count as 0) and its batches */
function stockByProduct(batchRows) {
  const batches = batchRows.map((b) => ({ branchId: b.branch_id, product: b.product, category: b.category, batch: b.batch, expiry: b.expiry_date ?? null, stock: b.units }))
  return [...groupBy(batches, (b) => `${b.branchId}|${productKey(b.product)}`).values()].map((group) => ({
    branchId: group[0].branchId,
    product: group[0].product,
    category: group[0].category,
    stock: sum(group, (b) => Math.max(0, b.stock)),
    batches: group.filter((b) => b.stock > 0),
  }))
}

function stockHealth(s, stock) {
  let expiredValue = 0
  let expiringValue = 0
  let expired = 0
  let expiring = 0
  for (const p of stock) {
    for (const b of p.batches) {
      const days = daysLeft(s, b.expiry)
      if (days === null) continue
      if (days < 0) {
        expired++
        expiredValue += b.stock * cost(s, p.product)
      } else if (days <= s.warningDays) {
        expiring++
        expiringValue += b.stock * cost(s, p.product)
      }
    }
  }
  return {
    productsInStock: stock.filter((p) => p.stock > 0).length,
    lowStockProducts: stock.filter((p) => p.stock > 0 && p.stock < s.minStock).length,
    outOfStockProducts: stock.filter((p) => p.stock <= 0).length,
    expiredBatches: expired,
    expiredValueAtCost: phpRound(expiredValue, 2),
    expiringSoonBatches: expiring,
    expiringSoonValueAtCost: phpRound(expiringValue, 2),
    stockValueAtCost: phpRound(
      sum(stock, (p) => p.stock * cost(s, p.product)),
      2,
    ),
  }
}

function outOfStock(s, stock, velocityHere) {
  const list = stock.filter((p) => p.stock <= 0).map((p) => ({ product: p.product, category: p.category, stock: 0, ...demand(p.product, velocityHere) }))
  return sortByDesc(list, 'unitsSoldRecently').slice(0, LIST_LIMIT)
}

function lowStock(s, stock, velocityHere) {
  const list = stock
    .filter((p) => p.stock > 0 && p.stock < s.minStock)
    .map((p) => {
      const d = demand(p.product, velocityHere)
      return { product: p.product, category: p.category, stock: p.stock, ...d, daysOfCover: d.avgDailySales > 0 ? phpRound(p.stock / d.avgDailySales, 1) : null }
    })
  return sortBy(list, (p) => p.daysOfCover ?? Number.MAX_SAFE_INTEGER).slice(0, LIST_LIMIT)
}

/** Batches past their date (expired) or inside the warning window, soonest first, with what they cost */
function expiryList(s, stock, expired) {
  const list = []
  for (const p of stock) {
    for (const b of p.batches) {
      const days = daysLeft(s, b.expiry)
      if (days === null || (expired ? days >= 0 : days < 0 || days > s.warningDays)) continue
      list.push({ product: p.product, batch: b.batch, expiry: b.expiry, daysLeft: days, units: b.stock, valueAtCost: phpRound(b.stock * cost(s, p.product), 2) })
    }
  }
  list.sort((a, b) => a.daysLeft - b.daysLeft)
  return list.slice(0, LIST_LIMIT)
}

/** Expired and expiring batches at every branch, with the branch named, soonest first */
function stockAtRisk(s) {
  const list = []
  for (const branch of s.branches.values()) {
    const here = s.stock.filter((p) => p.branchId === branch.id)
    for (const batch of [...expiryList(s, here, true), ...expiryList(s, here, false)]) list.push({ branch: branch.name, ...batch })
  }
  list.sort((a, b) => a.daysLeft - b.daysLeft)
  return list.slice(0, LIST_LIMIT)
}

/** In stock but nothing sold in the recent period: money sitting on the shelf */
function slowMovers(s, stock, velocityHere) {
  const list = stock
    .filter((p) => p.stock > 0 && !velocityHere.has(productKey(p.product)))
    .map((p) => ({ product: p.product, stock: p.stock, valueAtCost: phpRound(p.stock * cost(s, p.product), 2) }))
  return sortByDesc(list, 'valueAtCost').slice(0, 10)
}

/** Products low or out here that another branch holds comfortably above the minimum */
function transferOptions(s, branchId, stock) {
  const options = []
  for (const p of stock.filter((x) => x.stock < s.minStock)) {
    const elsewhere = surplusElsewhere(s, branchId, p.product, s.stock)
    if (elsewhere.length) options.push({ product: p.product, stockHere: p.stock, availableAt: elsewhere })
  }
  return options.slice(0, LIST_LIMIT)
}

function surplusElsewhere(s, branchId, product, stock) {
  return stock
    .filter((p) => p.branchId !== branchId && same(p.product, product) && p.stock > s.minStock * 1.5)
    .map((p) => ({ branch: branchName(s, p.branchId), stock: p.stock, canSpare: p.stock - s.minStock }))
}

async function onOrder(branchId, product) {
  const row = (await roleSnapshotRepository.unitsOnOrder(branchId, productKey(product)))[0]
  return toInt(row?.units)
}

async function transfersInTransit(s, column, branchId) {
  const rows = await roleSnapshotRepository.transfersInTransit(column, branchId)
  return rows.map((t) => ({ product: t.product, qty: toInt(t.qty), from: branchName(s, t.from_branch_id), to: branchName(s, t.to_branch_id), sentOn: utcDay(t.created_at) }))
}

// ---- Sales, damage, expenses ----

/** Units and revenue per product at a branch over the recent period, keyed by lower-case name */
async function velocity(s, branchId) {
  const rows = await roleSnapshotRepository.salesVelocity(branchId, dbTime(s.today.minus({ days: DAYS - 1 }).toUTC()))
  return new Map(rows.map((r) => [r.key, { product: r.product, units: toInt(r.units), revenue: toFloat(r.revenue) }]))
}

function demand(product, velocityHere) {
  const units = velocityHere.get(productKey(product))?.units ?? 0
  return { unitsSoldRecently: units, avgDailySales: phpRound(units / DAYS, 2) }
}

async function damageByReason(s, branchId) {
  const rows = await roleSnapshotRepository.damageByReason(s.today.minus({ days: DAYS - 1 }).toISODate(), branchId)
  return rows.map((r) => ({ reason: r.reason, units: toInt(r.units), loss: toFloat(r.loss), records: toInt(r.records) }))
}

async function expensesByCategory(s, branchId) {
  const rows = await roleSnapshotRepository.expensesByCategory(s.today.minus({ days: DAYS - 1 }).toISODate(), branchId)
  return rows.map((r) => ({ category: r.category, amount: toFloat(r.amount), records: toInt(r.records) }))
}

// ---- Helpers ----

/** Calendar days from today to an expiry date: 0 today, negative once past; null when there's no date */
function daysLeft(s, expiry) {
  if (!expiry) return null
  return Math.trunc(DateTime.fromISO(expiry, { zone: s.zone }).startOf('day').diff(s.today, 'days').days)
}

const cost = (s, product) => s.costs.get(productKey(product)) ?? 0

const branchName = (s, id) => s.branches.get(id)?.name ?? String(id ?? '')
