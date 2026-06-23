import { DateTime, config, productKey, roleLabel } from '../utils/index.js'
import { groupBy, round, sum, toFloat, truthy } from '../utils/helpers.js'
import { DAYS, LIST_LIMIT } from '../models/roleSnapshot.model.js'
import { currentPolicy } from '../repositories/policy.repository.js'
import * as roleSnapshotRepository from '../repositories/roleSnapshot.repository.js'
import { buildForecast } from './forecaster.service.js'
import { summary } from './ownerDashboard.service.js'
import * as insights from './ownerInsights.service.js'

/**
 * The figures the Owner's AI Assistance works from (AI Assistance is the Owner's only). No customer or staff names are
 * included, since this is sent to an outside AI service. Reads the business tables read-only.
 */

/**
 * scope: { from, to, branchId } — the period and branch the Owner is looking at; by default the last 30 days at every
 * branch.
 */
export async function snapshotFor(user, scope = null) {
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

  const branchId = truthy(scope?.branchId) ? scope.branchId : null
  const context = {
    role: roleLabel(user.role),
    scope: truthy(branchId) ? `Branch ${branchName(s, branchId)}` : 'All branches',
    today: today.toISODate(),
    currency: 'ETB',
    policy: { minimumStockUnits: s.minStock, expiryWarningDays: s.warningDays },
  }
  return { ...context, ...(await owner(s, branchId, scope)) }
}

// ---- The Owner's figures ----

/**
 * The Owner's business advisor: the chosen period at every branch or one, against the same length before it; every
 * branch side by side (so one branch can be ranked against the rest); products, stock, costs, purchasing, forecasts and
 * the audit trail's flagged events.
 */
async function owner(s, branchId, scope) {
  const to = scope?.to ?? s.today.toISODate()
  const from = scope?.from ?? s.today.minus({ days: DAYS - 1 }).toISODate()
  const period = insights.periodOf(from, to)
  const scoped = (list) => (truthy(branchId) ? list.filter((x) => x.branch === branchName(s, branchId)) : list)
  const name = (id) => branchName(s, id)
  const costOf = (product) => cost(s, product)
  const stockHere = truthy(branchId) ? s.stock.filter((p) => p.branchId === branchId) : s.stock

  const [now, before, everyBranch, salesRows, forecast, money, audit] = await Promise.all([
    summary(from, to, branchId),
    summary(period.previous.from, period.previous.to, branchId),
    summary(from, to, null),
    insights.productSales(period, branchId),
    buildForecast(s.minStock),
    insights.costsAndPurchasing(period, branchId, name),
    insights.auditIntelligence(period, branchId, name),
  ])

  const keys = ['sales', 'purchases', 'expenses', 'damageLoss', 'costOfSales', 'grossProfit', 'netProfit']
  const pick = (t) => Object.fromEntries(keys.map((k) => [k, round(toFloat(t[k]), 2)]))
  const scopedForecast = forecast.recommendations
    ? {
        ...forecast,
        stockOuts: scoped(forecast.stockOuts),
        reorders: scoped(forecast.reorders),
        expiryRisk: scoped(forecast.expiryRisk),
        recommendations: truthy(branchId) ? forecast.recommendations.filter((r) => r.text.includes(branchName(s, branchId))) : forecast.recommendations,
        revenueNext30Days: truthy(branchId) ? branchRevenueForecast(forecast.revenueNext30Days, branchName(s, branchId)) : forecast.revenueNext30Days,
      }
    : forecast

  return {
    period: { from, to, days: period.days, comparedWith: `${period.previous.from} to ${period.previous.to}` },
    totals: { ...pick(now.totals), salesCount: now.totals.salesCount, unitsSold: now.totals.unitsSold, purchasesCount: now.totals.purchasesCount, expensesCount: now.totals.expensesCount, damagedUnits: now.totals.damagedUnits },
    margins: {
      grossMarginPercent: now.totals.sales > 0 ? round((now.totals.grossProfit / now.totals.sales) * 100, 1) : null,
      netMarginPercent: now.totals.sales > 0 ? round((now.totals.netProfit / now.totals.sales) * 100, 1) : null,
    },
    previousPeriodTotals: pick(before.totals),
    changeVsPreviousPercent: insights.changes(now.totals, before.totals, keys),
    trend: insights.trend(now.daily, period.days),
    branchComparison: insights.branchComparison(everyBranch.branches, (id) => stockHealth(s, s.stock.filter((p) => p.branchId === id))),
    products: insights.productPerformance(salesRows),
    stockHealth: stockHealth(s, stockHere),
    stockAtRisk: scoped(stockAtRisk(s)),
    overstock: insights.overstock(stockHere, salesRows, period.days, name, costOf),
    ...money,
    staff: now.now,
    // Calculated forecasts (the AI explains them rather than predicting itself)
    forecast: scopedForecast,
    projectionNext30Days: insights.projection(now.totals, period.days, scopedForecast.expiryRisk ?? []),
    auditTrail: audit,
  }
}

/** The revenue forecast for one branch only: its own expected figure, so the company total can't be mistaken for it */
function branchRevenueForecast(revenue, name) {
  const expected = revenue.byBranch.find((b) => b.branch === name)?.expected ?? 0
  return { branch: name, expected, dailyAverage: round(expected / 30, 2), note: 'This branch only (company-wide trend not included).' }
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
    expiredValueAtCost: round(expiredValue, 2),
    expiringSoonBatches: expiring,
    expiringSoonValueAtCost: round(expiringValue, 2),
    stockValueAtCost: round(
      sum(stock, (p) => p.stock * cost(s, p.product)),
      2,
    ),
  }
}

/** Batches past their date (expired) or inside the warning window, soonest first, with what they cost */
function expiryList(s, stock, expired) {
  const list = []
  for (const p of stock) {
    for (const b of p.batches) {
      const days = daysLeft(s, b.expiry)
      if (days === null || (expired ? days >= 0 : days < 0 || days > s.warningDays)) continue
      list.push({ product: p.product, batch: b.batch, expiry: b.expiry, daysLeft: days, units: b.stock, valueAtCost: round(b.stock * cost(s, p.product), 2) })
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

// ---- Helpers ----

/** Calendar days from today to an expiry date: 0 today, negative once past; null when there's no date */
function daysLeft(s, expiry) {
  if (!expiry) return null
  return Math.trunc(DateTime.fromISO(expiry, { zone: s.zone }).startOf('day').diff(s.today, 'days').days)
}

const cost = (s, product) => s.costs.get(productKey(product)) ?? 0

const branchName = (s, id) => s.branches.get(id)?.name ?? String(id ?? '')
