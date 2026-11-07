import { DateTime, productKey } from '../utils/index.js'
import { groupBy, isoInZone, phpCompare, phpRound, sortBy, sortByDesc, sortByMany, sum, toFloat, toInt, truthy } from '../utils/php.js'
import { STATUSES } from '../models/inventoryReport.model.js'
import { currentPolicy } from '../repositories/policy.repository.js'
import * as inventoryReportRepository from '../repositories/inventoryReport.repository.js'

/**
 * Inventory Report: each branch's stock right now (from stock_batches, the same figures the Inventory page shows) with
 * its value and problems (low, out, expiring, expired), and how stock moved during the period.
 */
export async function buildInventoryReport(p) {
  const policy = await currentPolicy()
  const minStock = policy.default_min_stock
  const now = DateTime.now().setZone(p.zone)
  const today = now.toISODate()
  const soon = now.plus({ days: policy.expiry_warning_days }).toISODate()

  const [branchRows, prices, batches] = await Promise.all([
    inventoryReportRepository.branches(),
    loadPrices(),
    inventoryReportRepository.batches(truthy(p.branchId), p.branchId),
  ])
  const branches = new Map(branchRows.map((b) => [b.id, b.name]))
  const branchName = (id) => branches.get(id) ?? id
  // By catalog id when the batch has one the catalog knows, otherwise by name
  const price = (b, kind) => (truthy(b.med_id) ? prices.get(`id:${b.med_id}`) : undefined)?.[kind] ?? prices.get(`name:${b.product_key}`)?.[kind] ?? 0

  // Product totals at each branch decide Low / Out of Stock, like the Inventory page
  const products = new Map()
  for (const [key, group] of groupBy(batches, (b) => `${b.branch_id}|${b.product_key}`)) {
    products.set(key, { branchId: group[0].branch_id, product: group[0].product, category: group[0].category, units: sum(group, 'units') })
  }
  const productStatus = new Map([...products].map(([key, pr]) => [key, pr.units <= 0 ? 'Out of Stock' : pr.units < minStock ? 'Low Stock' : 'In Stock']))

  const rows = sortByMany(
    batches
      .filter((b) => b.units > 0)
      .map((b) => {
        const expiry = b.expiry_date ?? null
        const status =
          expiry && phpCompare(expiry, today) < 0
            ? 'Expired'
            : expiry && phpCompare(expiry, soon) <= 0
              ? 'Expiring Soon'
              : productStatus.get(`${b.branch_id}|${b.product_key}`)
        return {
          branch: branchName(b.branch_id),
          branchId: b.branch_id,
          product: b.product,
          category: b.category,
          batch: b.batch,
          expiry,
          units: b.units,
          unitCost: price(b, 'cost'),
          valueAtCost: phpRound(b.units * price(b, 'cost'), 2),
          valueAtSelling: phpRound(b.units * price(b, 'selling'), 2),
          status,
        }
      }),
    [
      ['branch', 'asc'],
      ['product', 'asc'],
      ['expiry', 'asc'],
    ],
  )

  const outOfStock = sortBy(
    [...products.values()].filter((pr) => pr.units <= 0).map((pr) => ({ branch: branchName(pr.branchId), product: pr.product, category: pr.category })),
    'product',
  )
  const withStatus = (status, list = rows) => list.filter((r) => r.status === status)
  const lowStatuses = [...productStatus].filter(([, s]) => s === 'Low Stock')

  return {
    asOf: isoInZone(DateTime.now().setZone(p.zone)),
    policy: { minimumStock: minStock, expiryWarningDays: policy.expiry_warning_days },
    totals: {
      products: [...products.values()].filter((pr) => pr.units > 0).length,
      units: toInt(sum(rows, 'units')),
      valueAtCost: phpRound(sum(rows, 'valueAtCost'), 2),
      valueAtSelling: phpRound(sum(rows, 'valueAtSelling'), 2),
      lowStock: lowStatuses.length,
      outOfStock: outOfStock.length,
      expiringSoon: withStatus('Expiring Soon').length,
      expired: withStatus('Expired').length,
      expiredValue: phpRound(sum(withStatus('Expired'), 'valueAtCost'), 2),
    },
    // Batches by what they need: fine, low, expiring, expired
    byStatus: STATUSES.map((s) => ({ status: s, batches: withStatus(s).length, units: toInt(sum(withStatus(s), 'units')) })),
    byBranch: sortByDesc(
      [...groupBy(rows, 'branch')].map(([branch, g]) => ({
        branch,
        units: toInt(sum(g, 'units')),
        valueAtCost: phpRound(sum(g, 'valueAtCost'), 2),
        // Products below the minimum at this branch (a batch can show as expiring and still be low)
        lowStock: lowStatuses.filter(([key]) => key.startsWith(`${g[0].branchId}|`)).length,
        expiringSoon: withStatus('Expiring Soon', g).length,
        expired: withStatus('Expired', g).length,
      })),
      'valueAtCost',
    ),
    byCategory: sortByDesc(
      [...groupBy(rows, 'category')].map(([category, g]) => ({ category, units: toInt(sum(g, 'units')), valueAtCost: phpRound(sum(g, 'valueAtCost'), 2) })),
      'valueAtCost',
    ),
    movement: await movement(p, branchRows),
    outOfStock,
    rows,
  }
}

/** Units in and out of each branch during the period */
async function movement(p, branchRows) {
  const received = p.timestamps('received_at')
  const transferredIn = p.timestamps('received_at', 'to_branch_id')
  const sold = p.timestamps('created_at')
  const transferredOut = p.timestamps('created_at', 'from_branch_id')
  const damaged = p.dates('damage_date')
  const corrected = p.timestamps('created_at')

  const units = (rows) => new Map(rows.map((r) => [r.branch_id, r.units]))
  const [receivedBy, transferredInBy, soldBy, transferredOutBy, damagedBy, correctedBy] = (
    await Promise.all([
      inventoryReportRepository.receivedByBranch(received),
      inventoryReportRepository.transferredInByBranch(transferredIn),
      inventoryReportRepository.soldByBranch(sold),
      inventoryReportRepository.transferredOutByBranch(transferredOut),
      inventoryReportRepository.damagedByBranch(damaged),
      inventoryReportRepository.correctedByBranch(corrected),
    ])
  ).map(units)

  return sortBy(
    branchRows
      .filter((b) => !truthy(p.branchId) || b.id === p.branchId)
      .map(({ id, name }) => ({
        branch: name,
        received: toInt(receivedBy.get(id) ?? 0) + toInt(transferredInBy.get(id) ?? 0),
        sold: toInt(soldBy.get(id) ?? 0),
        transferredOut: toInt(transferredOutBy.get(id) ?? 0),
        damaged: toInt(damagedBy.get(id) ?? 0),
        corrected: toInt(correctedBy.get(id) ?? 0),
      })),
    'branch',
  )
}

/** Purchase and selling price per product, found by catalog id or by name (the first product of a name wins) */
async function loadPrices() {
  const prices = new Map()
  for (const pr of await inventoryReportRepository.productPrices()) {
    const entry = { cost: toFloat(pr.purchase_price), selling: toFloat(pr.selling_price) }
    prices.set(`id:${pr.id}`, entry)
    const byName = `name:${productKey(pr.name)}`
    if (!prices.has(byName)) prices.set(byName, entry)
  }
  return prices
}
