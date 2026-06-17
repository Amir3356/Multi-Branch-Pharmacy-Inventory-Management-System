import { toFloat, toInt } from '../utils/helpers.js'
import { STAGES } from '../models/procurementReport.model.js'
import * as procurementReportRepository from '../repositories/procurementReport.repository.js'

/**
 * Procurement Report: purchase orders placed in a period (by order date): what was spent, with which suppliers, for
 * which branch, and where each order stands (paid and awaiting delivery, or received).
 */
export async function buildProcurementReport(p) {
  const { sql: orders, values } = p.timestamps('procurements.created_at', 'procurements.branch_id')

  const [totals, byStage, daily, bySupplier, byBranch, rows] = await Promise.all([
    procurementReportRepository.totals(orders, values),
    procurementReportRepository.byStage(orders, values),
    procurementReportRepository.daily(orders, values, p.localDay('procurements.created_at')),
    procurementReportRepository.bySupplier(orders, values),
    procurementReportRepository.byBranch(orders, values),
    procurementReportRepository.rows(orders, values),
  ])

  return {
    totals: {
      orders: toInt(totals.orders),
      spent: toFloat(totals.spent),
      paidOrders: toInt(totals.paid_orders),
      unitsBought: toInt(totals.units_bought),
      awaitingDelivery: toInt(totals.awaiting_delivery),
      suppliers: toInt(totals.suppliers),
    },
    byStage: STAGES.map((stage, i) => ({ stage, orders: toInt(byStage[i].orders), amount: toFloat(byStage[i].amount) })),
    daily: daily.map((r) => ({ date: r.day, spent: toFloat(r.spent), orders: toInt(r.orders) })),
    bySupplier: bySupplier.map((r) => ({ supplier: r.supplier, orders: toInt(r.orders), spent: toFloat(r.spent), units: toInt(r.units) })),
    byBranch: byBranch.map((r) => ({ branch: r.branch, spent: toFloat(r.spent), orders: toInt(r.orders) })),
    rows: rows.map((r) => ({
      id: r.id,
      at: p.local(r.created_at),
      branch: r.branch,
      supplier: r.supplier,
      product: r.product,
      category: r.category,
      qty: toInt(r.qty),
      unitPrice: toFloat(r.unit_price),
      total: toFloat(r.total),
      stage: r.stage,
      receivedAt: p.local(r.received_at),
      batch: r.batch,
      orderedBy: r.ordered_by,
    })),
  }
}
