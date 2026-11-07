import { audit, config, limit, logger, money, transaction } from '../utils/index.js'
import { nowSeconds, phpFloat, phpRound, rawurlencode } from '../utils/php.js'
import { isPending } from '../models/procurement.model.js'
import * as procurements from '../repositories/procurement.repository.js'
import { chapaClient } from './chapa.service.js'
import { fakeChapaClient } from './fakeChapa.service.js'
import { procurementChanged } from './procurementEvents.service.js'

// CHAPA_MODE=fake: payments succeed straight away (no checkout page), for local development without Chapa keys
export const chapa = config.chapa.mode === 'fake' ? fakeChapaClient : chapaClient

/**
 * Asks Chapa for a checkout page for this procurement and keeps its URL so the payment can be resumed.
 * `payer` is the signed-in user (req.user). Returns null in CHAPA_MODE=fake, where the payment is already made.
 */
export async function startCheckout(procurement, payer) {
  const [firstName, lastName = ''] = splitOnce(payer.fullName.trim(), ' ')

  const checkoutUrl = await chapa.initialize({
    amount: Number(procurement.total).toFixed(2),
    currency: procurement.currency,
    email: payer.email,
    first_name: firstName,
    last_name: lastName || firstName,
    tx_ref: procurement.tx_ref,
    // Chapa calls this server-to-server; it must be publicly reachable (it won't be on localhost)
    callback_url: `${config.appUrl}/api/procurements/chapa/callback`,
    // Where the person lands after paying: a page that closes the checkout popup (or, without one, opens the app)
    return_url: `${config.appUrl}/api/procurements/${rawurlencode(procurement.id)}/payment-return`,
    customization: {
      title: 'Procurement', // Chapa allows at most 16 characters
      // Only letters, numbers, spaces, dots, hyphens and underscores are accepted
      description: limit(`${procurement.id} ${procurement.qty} x ${procurement.product}`.replace(/[^A-Za-z0-9 ._-]/g, ''), 50, ''),
    },
  })

  if (checkoutUrl) await procurements.update(procurement.id, { checkout_url: checkoutUrl })
  return checkoutUrl
}

// PHP's explode($separator, $value, 2)
function splitOnce(value, separator) {
  const at = value.indexOf(separator)
  return at === -1 ? [value] : [value.slice(0, at), value.slice(at + separator.length)]
}

/**
 * Checks the payment with Chapa and records the outcome. Safe to call any number of times (return page, callback,
 * scheduled check): a procurement is marked paid only once. `req` is null for the scheduled check.
 */
export async function sync(procurement, req = null) {
  if (!isPending(procurement)) return procurement

  const tx = await chapa.verify(procurement.tx_ref)
  if (!tx) return procurement // not paid yet

  let changed = false
  const synced = await transaction(async (client) => {
    const locked = await procurements.lockForUpdate(client, procurement.id)
    if (!locked || !isPending(locked)) return locked ?? procurement
    changed = true

    const status = tx.status ?? null
    const amountMatches =
      phpRound(phpFloat(tx.amount ?? 0), 2) >= phpRound(Number(locked.total), 2) && String(tx.currency ?? '').toUpperCase() === locked.currency

    if (status === 'success' && amountMatches) {
      return procurements.update(
        locked.id,
        { status: 'paid', paid_at: nowSeconds(), chapa_reference: tx.reference ?? null, payment_method: tx.method ?? tx.payment_method ?? null },
        client,
      )
    }
    if (status === 'failed' || (status === 'success' && !amountMatches)) {
      return procurements.update(locked.id, { status: 'failed' }, client)
    }
    return locked
  })

  // Recorded once, by whichever check saw the change: the Purchase Officer's screen, Chapa's callback or the
  // scheduled check. Without a signed-in person it's the system's (Chapa's) doing.
  if (changed && !isPending(synced)) {
    const paid = synced.status === 'paid'
    audit(req, {
      module: 'Procurement',
      action: paid ? 'Payment confirmed' : 'Payment failed',
      recordId: synced.id,
      description: `${paid ? 'Chapa confirmed payment of ' : 'Chapa payment failed for '}${money(synced.total, synced.currency)} (${synced.qty} × ${synced.product}).`,
      branchId: synced.branch_id,
      actorName: req?.user ? null : 'Chapa',
      type: paid ? 'approve' : 'reject',
      before: procurement,
      after: synced,
    })
  }

  // Paid or Failed now: tell the receiving branch's screens, so a paid order's stock shows up without reloading
  if (!isPending(synced)) procurementChanged(synced)

  return synced
}

/**
 * Scheduled every 5 minutes: checks pending payments with Chapa, for when its callback never arrives (e.g. a server
 * Chapa can't reach) and the officer closed the page before returning from checkout.
 */
export async function verifyPendingProcurements() {
  // Give the officer a few minutes to pay first; after a day an unpaid checkout has lapsed
  for (const procurement of await procurements.pendingToVerify(5, 24)) {
    try {
      await sync(procurement, null)
    } catch (error) {
      // One failed check (Chapa unreachable) shouldn't stop the others; it's retried next run
      logger.warn('Procurement payment check failed', { procurement: procurement.id, error: error.message })
    }
  }
}
