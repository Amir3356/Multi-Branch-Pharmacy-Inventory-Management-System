import { DateTime } from '../utils/index.js'
import { phpRound, toFloat, toInt, truthy } from '../utils/php.js'
import * as financialReportRepository from '../repositories/financialReport.repository.js'
import { summary } from './ownerDashboard.service.js'

/**
 * Financial Report: profit and loss for a period, worked out exactly as the Owner's dashboard does (so the two always
 * agree), with where the money went and how it compares with the previous period of the same length.
 */
export async function buildFinancialReport(p) {
  const now = await summary(p.from, p.to, p.branchId)
  const t = now.totals

  // The same number of days just before this period
  const from = DateTime.fromISO(p.from, { zone: 'utc' })
  const days = DateTime.fromISO(p.to, { zone: 'utc' }).diff(from, 'days').days + 1
  const prevTo = from.minus({ days: 1 })
  const prevFrom = prevTo.minus({ days: days - 1 })
  const before = (await summary(prevFrom.toISODate(), prevTo.toISODate(), p.branchId)).totals

  const margin = (part) => (t.sales > 0 ? phpRound((part / t.sales) * 100, 1) : null)

  const expenses = p.dates('expense_date')
  const damaged = p.dates('damage_date')
  const listed = p.dates('expenses.expense_date', 'expenses.branch_id')
  const [byCategory, byReason, rows] = await Promise.all([
    financialReportRepository.expensesByCategory(expenses),
    financialReportRepository.damageByReason(damaged),
    financialReportRepository.expenseRows(listed),
  ])

  return {
    totals: {
      revenue: t.sales,
      costOfSales: t.costOfSales,
      grossProfit: t.grossProfit,
      expenses: t.expenses,
      damageLoss: t.damageLoss,
      netProfit: t.netProfit,
      purchases: t.purchases,
      grossMargin: margin(t.grossProfit),
      netMargin: margin(t.netProfit),
    },
    previous: {
      from: prevFrom.toISODate(),
      to: prevTo.toISODate(),
      revenue: before.sales,
      grossProfit: before.grossProfit,
      expenses: before.expenses,
      netProfit: before.netProfit,
    },
    daily: now.daily,
    // The branch filter doesn't apply here: every branch side by side
    byBranch: now.branches
      .filter((b) => !truthy(p.branchId) || b.id === p.branchId)
      .map((b) => ({ branch: b.name, revenue: b.sales, expenses: b.expenses, damageLoss: b.damageLoss, netProfit: b.netProfit })),
    expensesByCategory: byCategory.map((r) => ({ category: r.category, amount: toFloat(r.amount), entries: toInt(r.entries) })),
    damageByReason: byReason.map((r) => ({ reason: r.reason, loss: toFloat(r.loss), units: toInt(r.units) })),
    expenses: rows.map((r) => ({
      id: r.id,
      date: String(r.expense_date ?? '').slice(0, 10),
      branch: r.branch,
      category: r.category,
      description: r.description,
      amount: toFloat(r.amount),
      recordedBy: r.recorded_by,
    })),
  }
}
