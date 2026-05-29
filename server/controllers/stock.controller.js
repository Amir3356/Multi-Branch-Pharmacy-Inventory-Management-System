import * as stockService from '../services/stock.service.js'

/** GET /stock: rows are already stock resources */
export async function index(req, res) {
  res.json({ data: await stockService.visibleTo(req.user) })
}

/** PATCH /stock/:stockBatch (req.stockBatch from bindStockBatch, req.validated from the validator) */
export async function update(req, res) {
  const batch = req.stockBatch
  const result = await stockService.correct(req, batch, req.validated)

  res.json({
    message: result.changes.length ? `${batch.product} batch ${batch.batch} updated.` : 'No changes to save.',
    batch: result.batch,
  })
}
