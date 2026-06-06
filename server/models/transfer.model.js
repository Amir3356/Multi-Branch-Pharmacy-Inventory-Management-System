import { DateTime, config, iso8601 } from '../utils/index.js'

/** stock_transfers: stock sent by one branch, added to the other branch's stock once received */
export const TABLE = 'stock_transfers'
export const ID_PREFIX = 'TRF'
export const STATUSES = Object.freeze({ IN_TRANSIT: 'in_transit', RECEIVED: 'received' })

/** TransferResource. `t` is a stock_transfers row plus sender_name / receiver_name (TransferRepository's join) */
export const toResource = (t) => ({
  id: t.id,
  from: t.from_branch_id,
  to: t.to_branch_id,
  category: t.category,
  product: t.product,
  medId: t.med_id,
  // The sending branch's batch, and the new one the receiving branch added it under
  batch: t.batch,
  receivedBatch: t.received_batch,
  expiry: t.expiry_date ?? null,
  qty: t.qty,
  // Pending until the receiving branch adds it to stock (Receive Stock), then Received
  status: t.status === 'in_transit' ? 'Pending' : 'Received',
  // The day it was sent, in the store's time zone
  date: t.created_at ? DateTime.fromJSDate(t.created_at, { zone: 'utc' }).setZone(config.timezone).toISODate() : null,
  sentBy: t.sender_name ?? null,
  receivedBy: t.receiver_name ?? null,
  receivedAt: iso8601(t.received_at),
})
