import { HttpError, one } from './index.js'

/**
 * Laravel's 404 for a missing route-model binding, word for word:
 * "No query results for model [App\Features\Stock\Models\StockBatch] 7"
 */
export const modelNotFound = (model, id) => new HttpError(404, `No query results for model [${model}] ${id}`)

export const MODELS = Object.freeze({
  stockBatch: 'App\\Features\\Stock\\Models\\StockBatch',
  product: 'App\\Features\\Products\\Models\\Product',
  transfer: 'App\\Features\\Transfers\\Models\\StockTransfer',
})

/**
 * now() as Laravel stored it in a timestamp(0) column: cut to whole seconds. Postgres would round the fraction
 * instead, which can move a time a second ahead of what the response says.
 */
export const nowSeconds = () => new Date(Math.floor(Date.now() / 1000) * 1000)

/** PHP round($value, 2): half away from zero, without binary float surprises such as 1.005 → 1.00 */
export const roundMoney = (value) => {
  const n = Number(value)
  return Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100
}

/** AuditLogger::branchName(): a branch's name for descriptions, or its id when it no longer exists */
export async function branchName(branchId, client) {
  if (!branchId) return null
  const row = await one('select name from branches where id = $1', [branchId], client)
  return row?.name ?? branchId
}
