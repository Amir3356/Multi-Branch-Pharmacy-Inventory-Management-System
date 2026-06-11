/** damaged_items: stock written off at a branch */
export const TABLE = 'damaged_items'
export const ID_PREFIX = 'DMG'

// Why stock was written off; the client offers the same list
export const REASONS = Object.freeze([
  'Broken / crushed packaging',
  'Water damage',
  'Contaminated',
  'Temperature damage (cold chain)',
  'Defective item',
  'Other',
])

/** DamagedItemResource. `d` is a damaged_items row plus recorder_name */
export const toResource = (d) => ({
  id: d.id,
  branchId: d.branch_id,
  medId: d.med_id,
  product: d.product,
  category: d.category,
  batch: d.batch,
  qty: d.qty,
  reason: d.reason,
  lossValue: Number(d.loss_value),
  date: d.damage_date,
  recordedBy: d.recorder_name ?? null,
})
