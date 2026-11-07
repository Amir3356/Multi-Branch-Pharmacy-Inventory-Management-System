import * as salesService from '../services/sale.service.js'
import { toResource } from '../models/sale.model.js'

// Everyone reads sales (stock depends on them)
export async function index(req, res) {
  const rows = await salesService.visibleTo(req.user)
  res.json({ data: rows.map(toResource) })
}

/**
 * Records a sale. The Idempotency-Key header makes it safe to send again: a repeat returns the sale already recorded
 * (200, Idempotent-Replayed: true) instead of selling the units twice.
 */
export async function store(req, res) {
  const { sale, created } = await salesService.recordSale(req, req.validated)

  res
    .status(created ? 201 : 200)
    .set('Idempotent-Replayed', created ? 'false' : 'true')
    .json({ message: `Sale ${sale.id} recorded: ${sale.qty} × ${sale.product}.`, sale: toResource(sale) })
}
