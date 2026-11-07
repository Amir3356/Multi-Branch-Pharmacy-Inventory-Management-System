import { HttpError, audit, broadcast, money, nextId, transaction } from '../utils/index.js'
import { toResource } from '../models/transfer.model.js'
import { setPrices } from '../repositories/product.repository.js'
import { insert, lockForUpdate, setReceived, visibleTo, withPeople } from '../repositories/transfer.repository.js'
import { announceProducts } from './product.service.js'
import { add, stockBroadcaster, take } from './stock.service.js'
import { branchName, nowSeconds } from '../utils/support.js'

/** Newest first: every branch for those who cover all branches, otherwise what the user's branch sent or received */
export const list = (user) => visibleTo(user)

/** Both branches' screens update at once */
function announce(transfer) {
  const data = { transfer: toResource(transfer) }
  broadcast(`branch.${transfer.from_branch_id}.transfers`, 'transfer.changed', data)
  broadcast(`branch.${transfer.to_branch_id}.transfers`, 'transfer.changed', data)
}

/**
 * Sent: the units leave the sending branch's batch in the same transaction, or the transfer isn't saved. The expiry
 * date travels with the batch from the server's stock, not from the screen.
 */
async function create(client, live, attributes) {
  const batch = await take(client, live, attributes.from_branch_id, attributes.product, attributes.batch, Number(attributes.qty), 'sent')
  const id = await nextId(client, 'stock_transfers', 'TRF')
  const now = nowSeconds()
  await insert(client, id, attributes, batch.expiry_date ?? null, now)
  return id
}

/** Added to the receiving branch's stock under a new generated batch number. Call inside the receiving transaction. */
async function markReceived(client, live, transfer, byUserId) {
  const receivedAt = nowSeconds()
  const receivedBatch = await nextId(client, 'batches', 'BT')
  await setReceived(client, transfer.id, byUserId, receivedAt, receivedBatch)
  await add(client, live, {
    branchId: transfer.to_branch_id,
    product: transfer.product,
    category: transfer.category,
    medId: transfer.med_id,
    batch: receivedBatch,
    expiry: transfer.expiry_date,
    units: transfer.qty,
    receivedAt,
  })
}

/** POST /transfers: the units leave the sending branch. Returns the transfer row with sender / receiver names. */
export async function send(req, data) {
  const transfer = await transaction(async (client) => {
    const id = await create(client, stockBroadcaster(client), {
      from_branch_id: data.from,
      to_branch_id: data.to,
      category: data.category,
      product: data.product,
      med_id: data.medId ?? null,
      batch: data.batch,
      qty: Number(data.qty),
      status: 'in_transit',
      sent_by: req.user.id,
    })
    return withPeople(id, client)
  })

  announce(transfer)
  audit(req, {
    module: 'Stock Transfers',
    action: 'Stock sent',
    recordId: transfer.id,
    description: `${transfer.qty} × ${transfer.product} (batch ${transfer.batch}) sent from ${await branchName(transfer.from_branch_id)} to ${await branchName(transfer.to_branch_id)}.`,
    branchId: transfer.from_branch_id,
    after: transfer,
  })

  return transfer
}

/** Receiving branch's Inventory Officer (Receive Stock): the units enter their stock, once. Returns the transfer row. */
export async function receive(req, found, sellingPrice) {
  const received = await transaction(async (client) => {
    const locked = await lockForUpdate(found.id, client)
    if (locked.status !== 'in_transit') throw new HttpError(422, 'This transfer was already added to stock.')

    // The selling price is the product's, at every branch
    await setPrices(client, locked.med_id, null, sellingPrice, req.user.id)
    await markReceived(client, stockBroadcaster(client), locked, req.user.id)
    return withPeople(locked.id, client)
  })

  announce(received)
  announceProducts()
  audit(req, {
    module: 'Stock Transfers',
    action: 'Transfer received',
    recordId: received.id,
    description: `${received.qty} × ${received.product} from ${await branchName(received.from_branch_id)} added as batch ${received.received_batch}, selling at ${money(sellingPrice)}.`,
    branchId: received.to_branch_id,
    type: 'approve',
    before: found,
    after: received,
  })

  return received
}
