// npm run rebuild-stock (formerly php artisan stock:rebuild): repairs stock_batches by working every branch's stock
// out again from received orders and transfers, transfers sent, sales, damaged items and corrections.
import { pool } from '../utils/index.js'
import { rebuildStock } from '../services/stockRebuild.service.js'

try {
  const result = await rebuildStock()
  console.log(`Stock rebuilt: ${result.batches} batches.`)
  for (const b of result.belowZero) {
    console.warn(`${b.branchId} · ${b.product} · batch ${b.batch}: the records take out ${-b.stock} more units than arrived; saved as 0.`)
  }
  process.exitCode = 0
} catch (error) {
  console.error(`Stock rebuild failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
