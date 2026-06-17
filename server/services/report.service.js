import { ReportPeriod } from '../utils/reportPeriod.js'
import { buildFinancialReport } from './financialReport.service.js'
import { buildInventoryReport } from './inventoryReport.service.js'
import { buildProcurementReport } from './procurementReport.service.js'
import { buildSalesReport } from './salesReport.service.js'
import { buildUserReport } from './userReport.service.js'

/**
 * The reports under Reports (the Owner's; the Cashier's Sales Report, the Inventory Officer's Inventory Report and the
 * Purchase Officer's Procurement Report): each for a period (the store's calendar days) and every branch or one.
 * Read only. `data` is the validated { from, to, branchId? }.
 */
async function respond(data, user, build) {
  // Staff who work at one branch only ever see theirs, whatever was asked for
  const branchId = user.coversAllBranches ? (data.branchId ?? null) : user.branchId
  const period = new ReportPeriod(data.from, data.to, branchId)
  return { from: period.from, to: period.to, branchId: period.branchId, ...(await build(period)) }
}

// The Owner's reports
export const financialReport = (data, user) => respond(data, user, buildFinancialReport)
export const userReport = (data, user) => respond(data, user, buildUserReport)

// The Procurement Report is the Purchase Officer's too: they buy for every branch
export const procurementReport = (data, user) => respond(data, user, buildProcurementReport)

// The Inventory Officer sees the Inventory Report for their own branch (respond keeps them to it)
export const inventoryReport = (data, user) => respond(data, user, buildInventoryReport)

// The Cashier sees the Sales Report for their own branch, without purchase-price figures
export const salesReport = (data, user) =>
  respond(data, user, async (period) => {
    const report = await buildSalesReport(period)
    // Cost and profit come from purchase prices, which only the Owner sees here
    if (user.role !== 'owner') {
      delete report.totals.costOfSales
      delete report.totals.grossProfit
    }
    return report
  })
