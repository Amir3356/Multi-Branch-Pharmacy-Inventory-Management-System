import { toResource } from '../models/procurement.model.js'
import * as procurementService from '../services/procurement.service.js'

export async function index(req, res) {
  const rows = await procurementService.visibleTo(req.user)
  res.json({ data: rows.map(toResource) })
}

/**
 * Create Procurement modal (Purchase Officer): records a paid order for the receiving branch to add to stock. The
 * Idempotency-Key header makes it safe to send again: a repeat returns the order already recorded (200,
 * Idempotent-Replayed: true) instead of recording it twice.
 */
export async function store(req, res) {
  const { procurement, created } = await procurementService.create(req, req.validated)
  res.status(created ? 201 : 200).set('Idempotent-Replayed', created ? 'false' : 'true').json({
    message: `Procurement ${procurement.id} recorded. The receiving branch's Inventory Officer can now add it to stock.`,
    procurement: toResource(procurement),
  })
}

// Inventory Officer (Receive Stock): add a paid order's stock to their own branch, once
export async function receive(req, res) {
  const received = await procurementService.receive(req, req.procurement, req.validated)
  res.json({
    message: `${received.qty} × ${received.product} (batch ${received.batch}) added to stock.`,
    procurement: toResource(received),
  })
}
