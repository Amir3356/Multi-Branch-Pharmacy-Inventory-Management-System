import { DateTime, config } from '../utils/index.js'
import { dbTime, toFloat, toInt, truthy } from '../utils/php.js'
import * as ownerDashboardRepository from '../repositories/ownerDashboard.repository.js'

/**
 * A copy of reporting-service's ownerDashboard.service.js: the Owner's AI snapshot uses the same figures as the dashboard.
 * The Owner's dashboard figures, worked out in the database for a period (calendar days in the store's time zone)
 * and optionally one branch. Sales count by when they were made, purchases by order date (paid orders only, as on the
 * Purchase Officer's dashboard), expenses by their expense date, damaged stock by the day it was written off.
 * Reads sales, procurements, expenses, damaged_items, products, branches and users (owned by other services).
 */
export async function summary(from, to, branchId) {
  // Timestamps are stored in UTC; the period's days are the store's
  const zone = config.timezone
  const start = dbTime(DateTime.fromISO(from, { zone }).startOf('day').toUTC())
  const end = dbTime(DateTime.fromISO(to, { zone }).endOf('day').toUTC())
  const byBranch = truthy(branchId)

  const { sales, purchases, expenses, damaged } = ownerDashboardRepository.periodConditions(start, end, from, to, branchId, byBranch)

  // Cost of what was sold: units × the product's purchase price (its latest, the one Receive Stock recorded)
  const [cost, salesRow, purchasesRow, expensesRow, damagedRow] = await Promise.all([
    ownerDashboardRepository.costOfSales(sales),
    ownerDashboardRepository.salesTotals(sales),
    ownerDashboardRepository.purchaseTotals(purchases),
    ownerDashboardRepository.expenseTotals(expenses),
    ownerDashboardRepository.damageTotals(damaged),
  ])
  const costOfSales = toFloat(cost.cost)
  const salesTotal = toFloat(salesRow.total)
  const expensesTotal = toFloat(expensesRow.total)
  // What written-off stock cost to buy: it was paid for and can't be sold
  const damageLoss = toFloat(damagedRow.total)

  const [now, daily, branches, topProducts] = await Promise.all([
    rightNow(branchId),
    dailyFigures(sales, purchases, expenses),
    branchFigures(start, end, from, to),
    ownerDashboardRepository.topProducts(sales),
  ])

  return {
    totals: {
      sales: salesTotal,
      salesCount: toInt(salesRow.count),
      unitsSold: toInt(salesRow.qty),
      purchases: toFloat(purchasesRow.total),
      purchasesCount: toInt(purchasesRow.count),
      expenses: expensesTotal,
      expensesCount: toInt(expensesRow.count),
      damageLoss,
      damagedUnits: toInt(damagedRow.qty),
      costOfSales,
      grossProfit: salesTotal - costOfSales,
      netProfit: salesTotal - costOfSales - expensesTotal - damageLoss,
    },
    now,
    daily,
    branches,
    topProducts: topProducts.map((r) => ({ product: r.product, total: toFloat(r.total), qty: toInt(r.qty) })),
  }
}

/** Sales, purchases and expenses per day of the period that had any */
async function dailyFigures(sales, purchases, expenses) {
  const [salesDays, purchaseDays, expenseDays] = await Promise.all([
    ownerDashboardRepository.dailySales(sales),
    ownerDashboardRepository.dailyPurchases(purchases),
    ownerDashboardRepository.dailyExpenses(expenses),
  ])
  const days = {}
  for (const r of salesDays) (days[r.day] ??= {}).sales = toFloat(r.amount)
  for (const r of purchaseDays) (days[r.day] ??= {}).purchases = toFloat(r.amount)
  for (const r of expenseDays) (days[r.day] ??= {}).expenses = toFloat(r.amount)
  // ksort: every key is YYYY-MM-DD, so string order is date order
  return Object.keys(days)
    .sort()
    .map((day) => ({ date: day, sales: days[day].sales ?? 0, purchases: days[day].purchases ?? 0, expenses: days[day].expenses ?? 0 }))
}

/** Every branch's figures for the period, side by side (the branch filter doesn't apply here) */
async function branchFigures(start, end, from, to) {
  const [sales, purchases, expenses, damaged, branches] = await Promise.all([
    ownerDashboardRepository.salesByBranch(start, end),
    ownerDashboardRepository.purchasesByBranch(start, end),
    ownerDashboardRepository.expensesByBranch(from, to),
    ownerDashboardRepository.damageByBranch(from, to),
    ownerDashboardRepository.branchesByName(),
  ])
  const keyed = (rows) => new Map(rows.map((r) => [r.branch_id, r]))
  const [salesBy, purchasesBy, expensesBy, damagedBy] = [keyed(sales), keyed(purchases), keyed(expenses), keyed(damaged)]

  return branches.map((b) => {
    const sold = toFloat(salesBy.get(b.id)?.total)
    const cost = toFloat(salesBy.get(b.id)?.cost)
    const spent = toFloat(expensesBy.get(b.id)?.total)
    const lost = toFloat(damagedBy.get(b.id)?.total)
    return {
      id: b.id,
      name: b.name,
      status: b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : '',
      sales: sold,
      salesCount: toInt(salesBy.get(b.id)?.count),
      purchases: toFloat(purchasesBy.get(b.id)?.total),
      expenses: spent,
      damageLoss: lost,
      netProfit: sold - cost - spent - lost,
    }
  })
}

/** Figures that don't depend on the period */
async function rightNow(branchId) {
  const byBranch = truthy(branchId)
  const [branches, activeStaff, invitedStaff, pending] = await Promise.all([
    ownerDashboardRepository.branchCounts(),
    ownerDashboardRepository.activeStaffCount(byBranch, branchId),
    ownerDashboardRepository.invitedStaffCount(byBranch, branchId),
    ownerDashboardRepository.pendingOrders(byBranch, branchId),
  ])
  return {
    activeBranches: toInt(branches.active),
    totalBranches: toInt(branches.total),
    activeStaff: toInt(activeStaff.count),
    invitedStaff: toInt(invitedStaff.count),
    awaitingPayment: toInt(pending.count),
    awaitingPaymentAmount: toFloat(pending.total),
  }
}
