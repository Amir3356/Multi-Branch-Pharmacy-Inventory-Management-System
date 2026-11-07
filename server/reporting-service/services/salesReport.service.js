import { phpRound, toFloat, toInt } from '../utils/php.js'
import * as salesReportRepository from '../repositories/salesReport.repository.js'

/** Sales Report: what was sold in a period, where, by whom, and which products earn the most */
export async function buildSalesReport(p) {
  const { sql: where, values } = p.timestamps('sales.created_at', 'sales.branch_id')

  const [totals, cost, daily, byBranch, byCategory, topProducts, byCashier, rows] = await Promise.all([
    salesReportRepository.totals(where, values),
    salesReportRepository.costOfSales(where, values),
    salesReportRepository.daily(where, values, p.localDay('sales.created_at')),
    salesReportRepository.byBranch(where, values),
    salesReportRepository.byCategory(where, values),
    salesReportRepository.topProducts(where, values),
    salesReportRepository.byCashier(where, values),
    salesReportRepository.rows(where, values),
  ])

  const revenue = toFloat(totals.revenue)
  const count = toInt(totals.count)
  const costOfSales = toFloat(cost.cost)

  return {
    totals: {
      revenue,
      transactions: count,
      units: toInt(totals.units),
      averageSale: count ? phpRound(revenue / count, 2) : 0,
      costOfSales,
      grossProfit: revenue - costOfSales,
    },
    daily: daily.map((r) => ({ date: r.day, revenue: toFloat(r.revenue), transactions: toInt(r.transactions) })),
    byBranch: byBranch.map((r) => ({ branch: r.branch, revenue: toFloat(r.revenue), transactions: toInt(r.transactions), units: toInt(r.units) })),
    byCategory: byCategory.map((r) => ({ category: r.category, revenue: toFloat(r.revenue), units: toInt(r.units) })),
    topProducts: topProducts.map((r) => ({
      product: r.product,
      category: r.category,
      units: toInt(r.units),
      revenue: toFloat(r.revenue),
      transactions: toInt(r.transactions),
    })),
    byCashier: byCashier.map((r) => ({
      cashier: r.cashier,
      branch: r.branch,
      transactions: toInt(r.transactions),
      revenue: toFloat(r.revenue),
      units: toInt(r.units),
    })),
    rows: rows.map((r) => ({
      id: r.id,
      at: p.local(r.created_at),
      branch: r.branch,
      cashier: r.cashier ?? 'Former staff',
      customer: r.customer,
      product: r.product,
      category: r.category,
      qty: toInt(r.qty),
      unitPrice: toFloat(r.unit_price),
      total: toFloat(r.total),
    })),
    rowsTotal: count,
  }
}
