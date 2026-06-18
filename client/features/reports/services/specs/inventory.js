import { count, date, dateTime } from './common'

const STATUS_TONES = { 'In Stock': 'status-good', 'Low Stock': 'status-warning', 'Expiring Soon': 'status-serious', Expired: 'status-critical' }

/** Inventory Report: stock right now (value and problems) and how it moved during the period */
export function inventorySpec(d, money) {
  const t = d.totals
  const movementSeries = [
    { key: 'received', label: 'Received', tone: 'role-1' },
    { key: 'sold', label: 'Sold', tone: 'role-2' },
    { key: 'transferredOut', label: 'Sent to branches', tone: 'role-3' },
    { key: 'damaged', label: 'Damaged', tone: 'role-4' }
  ]
  return {
    note: `Stock as of ${dateTime(d.asOf)} · low stock = under ${count(d.policy.minimumStock)} units · expiring soon = within ${count(d.policy.expiryWarningDays)} days`,
    cards: [
      {
        title: 'Total Purchase Cost',
        icon: 'value',
        tone: 'cyan',
        value: money(t.valueAtCost),
        hint: 'Total cost paid to buy all items currently in stock.',
        chip: `Total Selling Price: ${money(t.valueAtSelling)}`
      },
      { title: 'Units in Stock', icon: 'units', tone: 'teal', value: count(t.units), chip: `${count(t.products)} ${t.products === 1 ? 'product' : 'products'}` },
      { title: 'Low or Out of Stock', icon: 'low', tone: 'warning', value: count(t.lowStock + t.outOfStock), chip: `${count(t.lowStock)} low · ${count(t.outOfStock)} out`, chipTone: t.lowStock + t.outOfStock ? 'negative' : 'positive' },
      { title: 'Expiring or Expired', icon: 'expiry', tone: 'danger', value: count(t.expiringSoon + t.expired), chip: t.expired ? `${count(t.expired)} expired · ${money(t.expiredValue)} lost` : `${count(t.expiringSoon)} expiring soon`, chipTone: t.expired ? 'negative' : 'neutral' }
    ],
    charts: [
      { kind: 'donut', title: 'Batches by condition', subtitle: 'Every batch with stock', unit: 'batches', items: d.byStatus.map((s) => ({ label: s.status, value: s.batches, tone: STATUS_TONES[s.status] })), empty: 'No stock.' },
      { kind: 'hbar', title: 'Stock value by branch', subtitle: 'At purchase price', money: true, items: d.byBranch.map((b) => ({ label: b.branch, value: b.valueAtCost, tone: 'role-1', detail: `${count(b.units)} units` })), empty: 'No stock.' },
      {
        // Horizontal bars: one per kind of movement (Received, Sold, Sent to branches, Damaged), in the series' colours.
        // With more than one branch each bar is named "Branch · Received", …; branches with no movement are left out.
        kind: 'hbar',
        title: 'Stock movement in the period',
        subtitle: 'Units in and out per branch',
        items: (() => {
          const moved = d.movement.filter((m) => movementSeries.some((s) => m[s.key] > 0))
          return moved.flatMap((m) =>
            movementSeries.map((s) => ({
              label: moved.length > 1 ? `${m.branch} · ${s.label}` : s.label,
              value: m[s.key] || 0,
              tone: s.tone,
              detail: 'units'
            }))
          )
        })(),
        empty: 'No stock moved in this period.'
      },
      { kind: 'hbar', title: 'Stock value by category', subtitle: 'At purchase price', money: true, items: d.byCategory.slice(0, 8).map((c) => ({ label: c.category, value: c.valueAtCost, tone: 'role-3', detail: `${count(c.units)} units` })), empty: 'No stock.' }
    ],
    tables: [
      {
        title: 'Branches',
        columns: [{ label: 'Branch' }, { label: 'Units', align: 'right' }, { label: 'Value', align: 'right' }, { label: 'Low stock', align: 'right' }, { label: 'Expiring soon', align: 'right' }, { label: 'Expired', align: 'right' }],
        rows: d.byBranch.map((b) => [b.branch, count(b.units), money(b.valueAtCost), count(b.lowStock), count(b.expiringSoon), count(b.expired)]),
        empty: 'No stock.'
      },
      {
        title: 'Stock movement',
        columns: [{ label: 'Branch' }, { label: 'Received', align: 'right' }, { label: 'Sold', align: 'right' }, { label: 'Sent to branches', align: 'right' }, { label: 'Damaged', align: 'right' }, { label: 'Corrections', align: 'right' }],
        rows: d.movement.map((m) => [m.branch, count(m.received), count(m.sold), count(m.transferredOut), count(m.damaged), m.corrected > 0 ? `+${count(m.corrected)}` : count(m.corrected)]),
        empty: 'No branches.'
      },
      {
        title: 'Out of stock',
        columns: [{ label: 'Branch' }, { label: 'Product' }, { label: 'Category' }],
        rows: d.outOfStock.map((o) => [o.branch, o.product, o.category]),
        empty: 'Nothing is out of stock.'
      },
      {
        title: 'Every batch in stock',
        columns: [{ label: 'Branch' }, { label: 'Product' }, { label: 'Category' }, { label: 'Batch' }, { label: 'Expiry' }, { label: 'Units', align: 'right' }, { label: 'Unit Cost', align: 'right' }, { label: 'Value', align: 'right' }, { label: 'Condition' }],
        rows: d.rows.map((r) => [r.branch, r.product, r.category, r.batch, date(r.expiry), count(r.units), money(r.unitCost), money(r.valueAtCost), r.status]),
        empty: 'No stock.'
      }
    ]
  }
}
