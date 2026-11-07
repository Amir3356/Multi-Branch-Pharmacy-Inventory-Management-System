import { audit, broadcast, money, nextId, storeToday, transaction } from '../utils/index.js'
import { toResource } from '../models/damagedItem.model.js'
import { insert, unitCost, visibleTo, withRecorder } from '../repositories/damagedItem.repository.js'
import { stockBroadcaster, take } from './stock.service.js'
import { nowSeconds, roundMoney } from '../utils/support.js'

/** Newest first: every branch for those who cover all branches, otherwise the user's own branch */
export const list = (user) => visibleTo(user)

/** The record and the units leaving the batch are saved together; expired batches can be written off too */
async function create(client, live, attributes) {
  await take(client, live, attributes.branch_id, attributes.product, attributes.batch, Number(attributes.qty))
  const id = await nextId(client, 'damaged_items', 'DMG')
  const now = nowSeconds()
  await insert(client, id, attributes, now)
  return withRecorder(id, client)
}

/** Writes off damaged stock at the user's branch. Returns { item (row), damagedItem (resource) }. */
export async function record(req, data) {
  const branchId = req.user.branchId

  // Worked out here, not taken from the client, so the Owner's net profit can rely on it
  const qty = Number(data.qty)
  const lossValue = roundMoney(qty * (await unitCost(data.medId ?? null)))

  const item = await transaction(async (client) =>
    create(client, stockBroadcaster(client), {
      branch_id: branchId,
      med_id: data.medId ?? null,
      product: data.product,
      category: data.category,
      batch: data.batch,
      qty,
      reason: data.reason,
      loss_value: lossValue,
      damage_date: storeToday(),
      recorded_by: req.user.id,
    }),
  )

  const damagedItem = toResource(item)
  broadcast(`branch.${item.branch_id}.damaged`, 'damage.recorded', { damagedItem })
  audit(req, {
    module: 'Damaged Items',
    action: 'Damage recorded',
    recordId: item.id,
    description: `${item.qty} × ${item.product} (batch ${item.batch}) written off: ${item.reason}. Loss ${money(item.loss_value)}.`,
    branchId: item.branch_id,
    after: item,
  })

  return { item, damagedItem }
}
