import { DateTime, config, productKey, roleLabel } from '../utils/index.js'
import { dbTime } from '../utils/time.js'
import { round, sortByDesc, sum, toFloat, toInt, truthy } from '../utils/helpers.js'
import * as repo from '../repositories/ownerInsights.repository.js'

/**
 * The Owner's AI business advisor: figures for a chosen period and scope (every branch, or one), worked out here so
 * the AI explains real numbers instead of guessing. Anomalies in the audit trail are flagged by fixed rules below,
 * never by the AI. People appear only as their role and a number ("Cashier #12"): no names leave the system.
 */

// Opening hours (store time): changes outside them are flagged
const OPEN_HOUR = 7
const CLOSE_HOUR = 21
// A stock correction that removes at least this many units, or this share of the batch, is flagged
const CORRECTION_UNITS = 20
const CORRECTION_SHARE = 0.25
// A sale or expense this many times the period's average is flagged
const LARGE_TIMES = 3
// Failed sign-ins in one day worth flagging
const FAILED_SIGN_INS = 5
// Days of stock at the period's sales rate that count as overstocked
const OVERSTOCK_DAYS = 90

/**
 * Expenses in the period far above what that branch usually pays in that category (over LARGE_TIMES × its average in
 * the 180 days before). A category with no history there is judged against the median of all recent expenses, so a
 * one-off bill stands out while regular rent does not.
 */
function unusualExpenses(rows, periodFrom) {
  const history = rows.filter((e) => e.expense_date < periodFrom)
  const amounts = history.map((e) => toFloat(e.amount)).sort((a, b) => a - b)
  const median = amounts.length ? amounts[Math.floor(amounts.length / 2)] : null
  const usual = new Map()
  for (const e of history) {
    const key = `${e.branch_id}|${e.category}`
    const u = usual.get(key) ?? { total: 0, count: 0 }
    usual.set(key, { total: u.total + toFloat(e.amount), count: u.count + 1 })
  }
  const found = []
  for (const e of rows.filter((x) => x.expense_date >= periodFrom)) {
    const u = usual.get(`${e.branch_id}|${e.category}`)
    const amount = toFloat(e.amount)
    if (u) {
      const average = u.total / u.count
      if (amount > LARGE_TIMES * average) found.push({ ...e, why: `${round(amount / average, 1)}× this branch's usual ${e.category} expense (${round(average, 2)} ETB).` })
    } else if (median && amount > LARGE_TIMES * median) {
      found.push({ ...e, why: `A first ${e.category} expense here, ${round(amount / median, 1)}× the typical expense (${round(median, 2)} ETB).` })
    }
  }
  return found.sort((a, b) => toFloat(b.amount) - toFloat(a.amount)).slice(0, 10)
}

/** A person as the AI sees them: role and account number, never a name */
export const who = (role, id) => (id ? `${role || 'User'} #${id}` : role || 'System')

/** The period: its local days as UTC timestamps, its length, and the same length just before it */
export function periodOf(from, to) {
  const zone = config.timezone
  const start = DateTime.fromISO(from, { zone }).startOf('day')
  const end = DateTime.fromISO(to, { zone }).endOf('day')
  const days = Math.max(1, Math.round(end.diff(start, 'days').days))
  const prevEnd = start.minus({ days: 1 })
  const prevStart = prevEnd.minus({ days: days - 1 })
  return {
    from,
    to,
    days,
    start: dbTime(start.toUTC()),
    end: dbTime(end.toUTC()),
    previous: { from: prevStart.toISODate(), to: prevEnd.toISODate() },
    zone,
  }
}

/** Percent change per figure from the previous period (null when there was nothing before) */
export function changes(now, before, keys) {
  return Object.fromEntries(
    keys.map((k) => {
      const a = toFloat(now[k])
      const b = toFloat(before[k])
      return [k, b === 0 ? null : round(((a - b) / Math.abs(b)) * 100, 1)]
    }),
  )
}

/** The daily figures grouped by day, week or month so a long period stays a short list */
export function trend(daily, days) {
  const unit = days <= 31 ? 'day' : days <= 120 ? 'week' : 'month'
  const buckets = new Map()
  for (const d of daily) {
    const date = DateTime.fromISO(d.date)
    const key = unit === 'day' ? d.date : unit === 'week' ? `week of ${date.startOf('week').toISODate()}` : date.toFormat('yyyy-MM')
    const b = buckets.get(key) ?? { period: key, sales: 0, purchases: 0, expenses: 0, damageLoss: 0, netProfit: 0 }
    for (const f of ['sales', 'purchases', 'expenses', 'damageLoss', 'netProfit']) b[f] = round(b[f] + toFloat(d[f]), 2)
    buckets.set(key, b)
  }
  return { groupedBy: unit, points: [...buckets.values()] }
}

/** Every branch side by side for the period, ranked by net profit, with margins and share of company sales */
export function branchComparison(branches, stockHealthOf) {
  const totalSales = sum(branches, 'sales')
  return sortByDesc(branches, 'netProfit').map((b, i) => ({
    rankByNetProfit: i + 1,
    branch: b.name,
    status: b.status,
    sales: b.sales,
    salesCount: b.salesCount,
    shareOfCompanySalesPercent: totalSales > 0 ? round((b.sales / totalSales) * 100, 1) : 0,
    purchases: b.purchases,
    expenses: b.expenses,
    damageLoss: b.damageLoss,
    netProfit: round(b.netProfit, 2),
    netMarginPercent: b.sales > 0 ? round((b.netProfit / b.sales) * 100, 1) : null,
    averageSale: b.salesCount > 0 ? round(b.sales / b.salesCount, 2) : 0,
    stock: stockHealthOf(b.id),
  }))
}

/** The next 30 days if the period's daily run-rate continues */
export function projection(totals, days, expiryRisk) {
  const rate = (v) => round((toFloat(v) / days) * 30, 2)
  return {
    basis: `The chosen period's daily average (${days} day${days === 1 ? '' : 's'}) carried forward 30 days.`,
    confidence: days < 14 ? 'low (a short period: treat as a rough guide)' : days < 60 ? 'medium' : 'good',
    sales: rate(totals.sales),
    costOfSales: rate(totals.costOfSales),
    expenses: rate(totals.expenses),
    purchases: rate(totals.purchases),
    damageLoss: rate(totals.damageLoss),
    netProfit: rate(totals.netProfit),
    // From the forecast: stock likely to expire before it sells, at what it cost
    expiryLossAtRisk: round(sum(expiryRisk, 'valueAtRisk'), 2),
  }
}

/** Stock that sells too slowly: nothing sold in the period, or more than OVERSTOCK_DAYS of stock at its sales rate */
export function overstock(stockRows, salesRows, days, branchName, costOf) {
  const sold = new Map(salesRows.map((r) => [`${r.branch_id}|${r.key}`, toInt(r.units)]))
  const list = []
  for (const p of stockRows) {
    if (p.stock <= 0) continue
    const units = sold.get(`${p.branchId}|${productKey(p.product)}`) ?? 0
    const perDay = units / days
    const daysOfStock = perDay > 0 ? Math.round(p.stock / perDay) : null
    if (daysOfStock !== null && daysOfStock <= OVERSTOCK_DAYS) continue
    list.push({
      branch: branchName(p.branchId),
      product: p.product,
      stock: p.stock,
      unitsSoldInPeriod: units,
      daysOfStockAtCurrentSales: daysOfStock ?? 'no sales in the period',
      valueAtCost: round(p.stock * costOf(p.product), 2),
    })
  }
  return sortByDesc(list, 'valueAtCost').slice(0, 15)
}

/** Units and revenue per branch and product in the period */
export const productSales = (period, branchId) => repo.productSales(period.start, period.end, branchId)

/** Best and slowest sellers in the period (by revenue), across the scope */
export function productPerformance(salesRows) {
  const merged = new Map()
  for (const r of salesRows) {
    const m = merged.get(r.key) ?? { product: r.product, units: 0, revenue: 0 }
    m.units += toInt(r.units)
    m.revenue = round(m.revenue + toFloat(r.revenue), 2)
    merged.set(r.key, m)
  }
  const ranked = sortByDesc([...merged.values()], 'revenue')
  // Slowest only when there are more products than the best-seller list shows
  return { bestSellers: ranked.slice(0, 10), slowestSellers: ranked.length > 10 ? ranked.slice(-5).reverse() : [] }
}

/** Expenses, damage and purchasing for the period */
export async function costsAndPurchasing(period, branchId, branchName) {
  const since = dbTime(DateTime.now().minus({ days: 180 }).toUTC())
  const [expenseRows, damageRows, supplierRows, priceRows, awaiting, transferRows] = await Promise.all([
    repo.expensesByCategory(period.from, period.to, branchId),
    repo.damageByReason(period.from, period.to, branchId),
    repo.suppliers(period.start, period.end, branchId),
    repo.supplierPrices(since, branchId),
    repo.awaitingDelivery(branchId),
    repo.transfers(period.start, period.end, branchId),
  ])

  // The same product bought from several suppliers: the cheapest and dearest average unit price
  const byProduct = new Map()
  for (const r of priceRows) byProduct.set(r.key, [...(byProduct.get(r.key) ?? []), r])
  const priceGaps = [...byProduct.values()]
    .filter((rows) => rows.length > 1)
    .map((rows) => {
      const sorted = [...rows].sort((a, b) => toFloat(a.unit_price) - toFloat(b.unit_price))
      const [low, high] = [sorted[0], sorted.at(-1)]
      return {
        product: low.product,
        cheapestSupplier: low.supplier,
        cheapestUnitPrice: toFloat(low.unit_price),
        dearestSupplier: high.supplier,
        dearestUnitPrice: toFloat(high.unit_price),
        gapPercent: toFloat(low.unit_price) > 0 ? round(((toFloat(high.unit_price) - toFloat(low.unit_price)) / toFloat(low.unit_price)) * 100, 1) : null,
      }
    })
    .filter((g) => (g.gapPercent ?? 0) >= 5)
  return {
    expensesByCategory: expenseRows.map((r) => ({ category: r.category, amount: toFloat(r.amount), records: toInt(r.records) })),
    damageByReason: damageRows.map((r) => ({ reason: r.reason, units: toInt(r.units), loss: toFloat(r.loss), records: toInt(r.records) })),
    suppliers: supplierRows.map((r) => ({ supplier: r.supplier, orders: toInt(r.orders), units: toInt(r.units), spent: toFloat(r.spent), products: toInt(r.products) })),
    supplierPriceGapsLast180Days: sortByDesc(priceGaps, 'gapPercent').slice(0, 10),
    paidOrdersAwaitingDelivery: {
      orders: toInt(awaiting?.orders),
      value: toFloat(awaiting?.value),
      oldestOrderedOn: awaiting?.oldest ? DateTime.fromJSDate(awaiting.oldest).setZone(period.zone).toISODate() : null,
    },
    transfersBetweenBranches: transferRows.map((t) => ({
      from: branchName(t.from_branch_id),
      to: branchName(t.to_branch_id),
      transfers: toInt(t.transfers),
      units: toInt(t.units),
      stillInTransit: toInt(t.in_transit),
    })),
  }
}

/**
 * The audit trail for the period: activity counts, plus `flags` — events worth the Owner's review, found by fixed
 * rules (big stock corrections, deletions, changes after hours, failed sign-ins, unusually large sales or expenses,
 * price changes). Each flag has a severity, what happened and why it was flagged.
 */
export async function auditIntelligence(period, branchId, branchName) {
  const zone = period.zone
  const local = (ts) => (ts ? DateTime.fromJSDate(ts).setZone(zone).toFormat('yyyy-MM-dd HH:mm') : null)
  const [counts, deletions, failed, afterHours, corrections, people, sales, expenses, prices] = await Promise.all([
    repo.auditCounts(period.start, period.end, branchId),
    repo.deletions(period.start, period.end, branchId),
    truthy(branchId) ? [] : repo.failedSignIns(period.start, period.end, zone),
    repo.afterHoursChanges(period.start, period.end, branchId, zone, OPEN_HOUR, CLOSE_HOUR),
    repo.stockCorrections(period.start, period.end, branchId),
    repo.activityByUser(period.start, period.end, branchId),
    repo.largeSales(period.start, period.end, branchId, LARGE_TIMES),
    repo.expensesSince(DateTime.fromISO(period.from).minus({ days: 180 }).toISODate(), period.to, branchId),
    truthy(branchId) ? [] : repo.priceChanges(period.start, period.end),
  ])

  const flags = []
  const flag = (severity, type, what, why, extra = {}) => flags.push({ severity, type, what, why, ...extra })

  for (const c of corrections) {
    const change = toInt(c.units_after) - toInt(c.units_before)
    const share = toInt(c.units_before) > 0 ? -change / toInt(c.units_before) : 0
    if (change < 0 && (-change >= CORRECTION_UNITS || share >= CORRECTION_SHARE)) {
      flag(
        -change >= CORRECTION_UNITS * 3 || share >= 0.5 ? 'high' : 'medium',
        'Stock correction',
        `${c.product} batch ${c.batch} at ${branchName(c.branch_id)} corrected from ${c.units_before} to ${c.units_after} units (${change})`,
        `Removes ${-change} units (${Math.round(share * 100)}% of the batch) without a sale or damage record.`,
        { when: local(c.created_at), by: who(c.adjusted_by_role ? roleLabel(c.adjusted_by_role) : null, c.adjusted_by) },
      )
    }
  }
  for (const d of deletions) {
    flag(['Sales', 'Expenses', 'Damaged Items', 'Inventory'].includes(d.module) ? 'medium' : 'low', 'Deletion', `${d.action}: ${d.description}`, 'Deleted records change the figures; check it was intended.', {
      when: local(d.occurred_at),
      by: who(d.user_role, d.user_id),
      branch: d.branch_name ?? null,
    })
  }
  for (const f of failed) {
    if (toInt(f.attempts) >= FAILED_SIGN_INS) {
      flag(toInt(f.attempts) >= FAILED_SIGN_INS * 3 ? 'high' : 'medium', 'Failed sign-ins', `${f.attempts} failed or blocked sign-ins on ${f.day} from ${f.addresses} address${toInt(f.addresses) === 1 ? '' : 'es'}`, 'Many failed sign-ins can mean someone is guessing passwords.', { when: f.day })
    }
  }
  for (const a of afterHours) {
    const time = (ts) => DateTime.fromJSDate(ts).setZone(zone).toFormat('HH:mm')
    flag(
      toInt(a.changes) >= 10 ? 'medium' : 'low',
      'After hours',
      `${a.changes} change${toInt(a.changes) === 1 ? '' : 's'} to ${a.modules}${a.branch_name ? ` at ${a.branch_name}` : ''} between ${time(a.first_at)} and ${time(a.last_at)}`,
      `Recorded outside ${OPEN_HOUR}:00–${CLOSE_HOUR}:00 store time.`,
      { when: a.day, by: who(a.user_role, a.user_id) },
    )
  }
  for (const s of sales) {
    flag('medium', 'Large sale', `Sale ${s.id}: ${s.qty} × ${s.product} for ${toFloat(s.total)} ETB at ${branchName(s.branch_id)}`, `${round(toFloat(s.total) / toFloat(s.average), 1)}× the period's average sale (${round(toFloat(s.average), 2)} ETB).`, { when: local(s.created_at), by: who('Cashier', s.sold_by) })
  }
  for (const e of unusualExpenses(expenses, period.from)) {
    flag('medium', 'Large expense', `Expense ${e.id}: ${e.category} ${toFloat(e.amount)} ETB at ${branchName(e.branch_id)}`, e.why, { when: e.expense_date, by: who(roleLabel('inventory_officer'), e.recorded_by) })
  }
  for (const p of prices) {
    flag('low', 'Price change', p.description, 'Selling prices change revenue and margin at every branch.', { when: local(p.occurred_at), by: who(p.user_role, p.user_id) })
  }

  const order = { high: 0, medium: 1, low: 2 }
  flags.sort((a, b) => order[a.severity] - order[b.severity])

  const byModule = {}
  const byType = {}
  for (const c of counts) {
    byModule[c.module] = (byModule[c.module] ?? 0) + toInt(c.count)
    byType[c.action_type] = (byType[c.action_type] ?? 0) + toInt(c.count)
  }
  return {
    rules: `Staff actions flagged by fixed rules (the Owner's own actions are never flagged): stock corrections removing ${CORRECTION_UNITS}+ units or ${CORRECTION_SHARE * 100}%+ of a batch, deletions of business records, business changes outside ${OPEN_HOUR}:00–${CLOSE_HOUR}:00, ${FAILED_SIGN_INS}+ failed sign-ins in a day, sales or expenses over ${LARGE_TIMES}× the average, and price changes.`,
    actionsByModule: byModule,
    actionsByType: byType,
    stockCorrections: corrections.length,
    mostActivePeople: people.slice(0, 8).map((p) => ({
      person: who(p.user_role, p.user_id),
      actions: toInt(p.actions),
      changes: toInt(p.changes),
      deletions: toInt(p.deletions),
      stockCorrections: toInt(p.corrections),
    })),
    flags: flags.slice(0, 25),
    flagCount: flags.length,
  }
}
