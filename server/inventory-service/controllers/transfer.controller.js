import { toResource } from '../models/transfer.model.js'
import * as transferService from '../services/transfer.service.js'

/** GET /transfers */
export async function index(req, res) {
  res.json({ data: (await transferService.list(req.user)).map(toResource) })
}

/** POST /transfers */
export async function store(req, res) {
  const transfer = await transferService.send(req, req.validated)

  res.status(201).json({
    message: `Transfer ${transfer.id} sent: ${transfer.qty} × ${transfer.product}. It reaches the other branch's stock once their Inventory Officer adds it.`,
    transfer: toResource(transfer),
  })
}

/** POST /transfers/:transfer/receive (req.transfer from bindTransfer, req.validated from the validator) */
export async function receive(req, res) {
  const sellingPrice = Number(req.validated.sellingPrice)
  const received = await transferService.receive(req, req.transfer, sellingPrice)

  res.json({
    message: `${received.qty} × ${received.product} added to stock as batch ${received.received_batch}.`,
    transfer: toResource(received),
  })
}
