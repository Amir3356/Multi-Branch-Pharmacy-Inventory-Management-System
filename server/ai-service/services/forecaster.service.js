import { DateTime, config, productKey } from '../utils/index.js'
import { dbTime, groupBy, phpCompare, phpRound, sortBy, sortByDesc, sum, toFloat, toInt } from '../utils/php.js'
import * as forecasterRepository from '../repositories/forecaster.repository.js'

/**
 * Forecasts and recommendations for the Owner's AI Assistance, calculated here from sales history and stock so the AI
 * explains real figures instead of guessing: next 30 days' revenue, when products run out, what to reorder and by when,
 * and stock likely to expire before it sells. Every branch.
 *
 * Method (kept simple and explainable): a product's daily sales rate is the units it sold at a branch over the recent
 * window (the last 30 days, or since sales began when that is shorter) divided by the window's days. Stock runs out
 * after sellable units ÷ rate days. A reorder covers 30 days of sales plus 7 days for delivery. Batches sell in
 * expiry order at the same rate.
 */
const WINDOW_DAYS = 30
const HISTORY_DAYS = 90
// Days of sales a reorder should cover once it arrives, and days a delivery is assumed to take
const COVER_DAYS = 30
const LEAD_DAYS = 7
const LIST_LIMIT = 15

// Carbon's (int) diffInDays(other, false) between two local midnights: whole calendar days, signed
const daysBetween = (from, to) => Math.trunc(to.diff(from, 'days').days)

export async function buildForecast(minStock) {
  const zone = config.timezone
  const today = DateTime.now().setZone(zone).startOf('day')
  const firstSale = (await forecasterRepository.firstSale())?.first
  if (!firstSale) {
    return { basis: 'No sales recorded yet, so nothing can be forecast. Forecasts start once sales come in.' }
  }

  const firstDay = DateTime.fromJSDate(firstSale).setZone(zone)
  const historyDays = Math.min(HISTORY_DAYS, daysBetween(firstDay.startOf('day'), today) + 1)
  const window = Math.min(WINDOW_DAYS, historyDays)
  const since = today.minus({ days: window - 1 })

  const [branchRows, productRows, rateRows, batchRows, orderRows] = await Promise.all([
    forecasterRepository.branches(),
    forecasterRepository.productCosts(),
    // Units sold per branch and product in the window → daily rate
    forecasterRepository.unitsSoldSince(dbTime(since.toUTC())),
    forecasterRepository.batchesInStock(),
    forecasterRepository.unitsOnOrder(),
  ])
  const branches = new Map(branchRows.map((b) => [b.id, b.name]))
  // mapWithKeys: a later product with the same name wins
  const costs = new Map(productRows.map((p) => [productKey(p.name), toFloat(p.purchase_price)]))
  const rates = new Map(rateRows.map((r) => [`${r.branch_id}|${r.product_key}`, { product: r.product, units: toInt(r.units), rate: toFloat(r.units) / window }]))
  const batches = groupBy(batchRows, (b) => `${b.branch_id}|${b.product_key}`)
  const onOrder = new Map(orderRows.map((r) => [`${r.branch_id}|${r.product_key}`, toInt(r.units)]))

  const todayKey = today.toISODate()
  const stockOuts = []
  const reorders = []
  const expiryRisk = []
  for (const key of new Set([...rates.keys(), ...batches.keys()])) {
    const [branchId, key2] = [key.slice(0, key.indexOf('|')), key.slice(key.indexOf('|') + 1)]
    const group = batches.get(key) ?? []
    const rate = rates.get(key)?.rate ?? 0
    const product = rates.get(key)?.product ?? group[0]?.product ?? null
    const branch = branches.get(branchId) ?? branchId
    const sellable = group.filter((b) => !b.expiry_date || phpCompare(b.expiry_date, todayKey) >= 0)
    const units = toInt(sum(sellable, 'units'))
    const ordered = onOrder.get(key) ?? 0
    const cost = costs.get(key2) ?? 0

    if (rate > 0) {
      const cover = units / rate
      const runOut = today.plus({ days: Math.floor(cover) })
      if (cover <= COVER_DAYS + LEAD_DAYS) {
        stockOuts.push({
          branch,
          product,
          unitsLeft: units,
          sellsPerDay: phpRound(rate, 2),
          daysLeft: Math.floor(cover),
          runsOutOn: units > 0 ? runOut.toISODate() : 'already out of stock',
        })
      }
      const need = Math.ceil(rate * (COVER_DAYS + LEAD_DAYS))
      const suggested = Math.max(0, need - units - ordered, units + ordered < minStock ? minStock - units - ordered : 0)
      if (suggested > 0) {
        const orderBy = runOut.minus({ days: LEAD_DAYS })
        reorders.push({
          branch,
          product,
          suggestedQty: suggested,
          unitsLeft: units,
          alreadyOnOrder: ordered,
          sellsPerDay: phpRound(rate, 2),
          orderBy: orderBy <= today ? 'now' : orderBy.toISODate(),
          estimatedCost: phpRound(suggested * cost, 2),
        })
      }
    }

    // Sell batches in expiry order at the current rate: what is still left when each one expires
    let sold = 0
    for (const b of sortBy(
      sellable.filter((x) => x.expiry_date),
      'expiry_date',
    )) {
      const daysToExpiry = daysBetween(today, DateTime.fromISO(b.expiry_date, { zone }))
      const canSell = Math.max(0, rate * daysToExpiry - sold)
      const unsold = Math.trunc(Math.max(0, b.units - Math.floor(canSell)))
      sold += Math.min(b.units, canSell)
      if (unsold > 0 && daysToExpiry <= 180) {
        expiryRisk.push({
          branch,
          product,
          batch: b.batch,
          expires: b.expiry_date,
          daysToExpiry,
          unitsInBatch: b.units,
          unitsLikelyUnsold: unsold,
          valueAtRisk: phpRound(unsold * cost, 2),
          betterBranch: fasterBranch(rates, branches, branchId, key2, rate),
        })
      }
    }
  }

  // usort is stable in PHP 8, as Array.prototype.sort is here
  stockOuts.sort((a, b) => a.daysLeft - b.daysLeft)
  const orderKey = (r) => (r.orderBy === 'now' ? '0' : r.orderBy)
  reorders.sort((a, b) => phpStrcmp(orderKey(a), orderKey(b)))
  expiryRisk.sort((a, b) => phpCompare(b.valueAtRisk, a.valueAtRisk))

  const revenue = await revenueForecast(since, window, historyDays, branches)

  return {
    basis:
      `Calculated by the system from ${historyDays} days of sales history (since ${firstDay.toISODate()}). Sales rates use the last ${window} days. ` +
      `Reorders cover ${COVER_DAYS} days of sales plus ${LEAD_DAYS} days for delivery.`,
    confidence: historyDays < 30 ? 'low (under 30 days of history: treat as a rough guide)' : historyDays < 90 ? 'medium' : 'good',
    revenueNext30Days: revenue,
    stockOuts: stockOuts.slice(0, LIST_LIMIT),
    reorders: reorders.slice(0, LIST_LIMIT),
    expiryRisk: expiryRisk.slice(0, LIST_LIMIT),
    recommendations: recommendations(stockOuts, reorders, expiryRisk, revenue),
  }
}

const phpStrcmp = (a, b) => Math.sign(Buffer.compare(Buffer.from(a), Buffer.from(b)))

/** Next 30 days' revenue at the recent daily average, per branch, with the trend once there is enough history */
async function revenueForecast(since, window, historyDays, branches) {
  const recentRows = await forecasterRepository.revenueByBranchSince(dbTime(since.toUTC()))
  const recent = new Map(recentRows.map((r) => [r.branch_id, r.total]))
  const total = sum(recentRows, 'total')
  let trend = null
  if (historyDays >= 2 * WINDOW_DAYS) {
    const before = toFloat(
      (await forecasterRepository.revenueBetween(dbTime(since.minus({ days: WINDOW_DAYS }).toUTC()), dbTime(since.toUTC())))
        ?.total,
    )
    trend = before > 0 ? phpRound(((total - before) / before) * 100, 1) : null
  }

  return {
    expected: phpRound((total / window) * 30, 2),
    dailyAverage: phpRound(total / window, 2),
    trendVsPrevious30DaysPercent: trend,
    byBranch: sortByDesc(
      [...branches].map(([id, name]) => ({ branch: name, expected: phpRound((toFloat(recent.get(id) ?? 0) / window) * 30, 2) })),
      'expected',
    ),
  }
}

/** Another branch that sells this product faster, where expiring units could be sent */
function fasterBranch(rates, branches, branchId, key, rate) {
  const candidates = [...branches.keys()]
    .filter((id) => id !== branchId)
    .map((id) => ({ branch: branches.get(id), rate: rates.get(`${id}|${key}`)?.rate ?? 0 }))
    .filter((b) => b.rate > rate)
  const best = sortByDesc(candidates, 'rate')[0]
  return best ? `${best.branch} (sells ${phpRound(best.rate, 2)} a day)` : null
}

/** What needs attention, most urgent first */
function recommendations(stockOuts, reorders, expiryRisk, revenue) {
  const list = []
  for (const s of stockOuts) {
    if (s.daysLeft <= LEAD_DAYS) {
      list.push({
        priority: 'high',
        text:
          `${s.product} at ${s.branch} ` +
          (s.unitsLeft ? `runs out in about ${s.daysLeft} days (${s.unitsLeft} left, sells ${s.sellsPerDay} a day)` : 'is out of stock but still selling') +
          ': reorder now.',
      })
    }
  }
  for (const e of expiryRisk) {
    list.push({
      priority: e.daysToExpiry <= 30 ? 'high' : 'medium',
      text:
        `${e.unitsLikelyUnsold} of ${e.unitsInBatch} ${e.product} (batch ${e.batch}) at ${e.branch} will likely expire unsold on ${e.expires}, worth ETB ${e.valueAtRisk}: ` +
        (e.betterBranch ? `transfer them to ${e.betterBranch}.` : 'sell these first or stop reordering this product here.'),
    })
  }
  for (const r of reorders) {
    if (r.orderBy !== 'now') {
      list.push({ priority: 'medium', text: `Order ${r.suggestedQty} ${r.product} for ${r.branch} by ${r.orderBy} (about ETB ${r.estimatedCost}).` })
    }
  }
  if ((revenue.trendVsPrevious30DaysPercent ?? 0) <= -10) {
    list.push({ priority: 'medium', text: `Revenue is down ${revenue.trendVsPrevious30DaysPercent}% on the 30 days before.` })
  }
  return list.slice(0, LIST_LIMIT)
}
