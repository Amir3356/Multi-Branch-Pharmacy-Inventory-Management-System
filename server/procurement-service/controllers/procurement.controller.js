import { config } from '../utils/index.js'
import { normalizeInput, phpString, rawurlencode } from '../utils/php.js'
import { paymentReturnPage } from '../utils/templates/paymentReturn.js'
import { toResource } from '../models/procurement.model.js'
import * as procurementService from '../services/procurement.service.js'

// Public: Chapa's server-to-server callback (GET or POST, with trx_ref)
export async function chapaCallback(req, res) {
  // Laravel's $request->input(): query and body together, the body winning
  const input = normalizeInput({ ...req.query, ...(req.body ?? {}) })
  const txRef = phpString(input.trx_ref ?? input.tx_ref ?? '')
  await procurementService.handleChapaCallback(txRef, req)
  res.json({ received: true })
}

// Public: Chapa's return_url. In the checkout popup it just closes, and the Procurement page underneath picks up the
// result; opened as a full page (popup blocked) it sends the officer back to the Procurement page, which verifies.
// Shows nothing about the order.
export function paymentReturn(req, res) {
  const appUrl = `${config.frontendUrl}/purchases?procurement=${rawurlencode(req.params.procurement)}`
  res.type('html').send(paymentReturnPage({ appUrl }))
}

export async function index(req, res) {
  const rows = await procurementService.visibleTo(req.user)
  res.json({ data: rows.map(toResource) })
}

// Create Procurement modal (Purchase Officer): a Pending order plus Chapa's checkout page, or (CHAPA_MODE=fake) an
// order that is already paid, with no checkout page
export async function store(req, res) {
  const { procurement, checkoutUrl } = await procurementService.create(req, req.validated)
  res.status(201).json({
    message: checkoutUrl
      ? `Procurement ${procurement.id} created. Complete the payment on Chapa to receive the stock.`
      : `Procurement ${procurement.id} created and paid. The receiving branch can now add the stock.`,
    procurement: toResource(procurement),
    checkoutUrl,
  })
}

// The Procurement page calls this when Chapa sends the officer back
export async function verify(req, res) {
  const procurement = await procurementService.verify(req.procurement, req)
  const messages = {
    paid: `Payment for ${procurement.id} confirmed. ${procurement.qty} × ${procurement.product} received into stock.`,
    failed: `Payment for ${procurement.id} failed. No stock was received.`,
  }
  res.json({
    message: messages[procurement.status] ?? `Payment for ${procurement.id} isn't complete yet. Use Complete payment to finish it on Chapa.`,
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
