import { count, dailyColumns, dateTime } from './common'

const STAGE_TONES = { Received: 'status-good', 'Paid, awaiting delivery': 'status-warning', 'Awaiting payment': 'status-serious', 'Payment failed': 'status-critical' }

/** Procurement Report: purchase orders placed in the period, what was spent with whom, and where each order stands */
export function procurementSpec(d, money) {
  const t = d.totals
  return {
    cards: [
      { title: 'Spent', icon: 'cost', tone: 'cyan', value: money(t.spent), chip: `${count(t.paidOrders)} paid ${t.paidOrders === 1 ? 'order' : 'orders'}` },
      { title: 'Orders Placed', icon: 'orders', tone: 'teal', value: count(t.orders), chip: `${count(t.suppliers)} ${t.suppliers === 1 ? 'supplier' : 'suppliers'} · ${count(t.unitsBought)} units` },
      { title: 'Awaiting Delivery', icon: 'delivery', tone: 'danger', value: count(t.awaitingDelivery), chip: t.failed ? `${count(t.failed)} payment${t.failed === 1 ? '' : 's'} failed` : 'Paid, not yet in stock', chipTone: t.failed ? 'negative' : 'neutral' }
    ],
    charts: [
      { kind: 'donut', title: 'Orders by stage', subtitle: 'Where each order stands', unit: 'orders', items: d.byStage.map((s) => ({ label: s.stage, value: s.orders, tone: STAGE_TONES[s.stage] })), empty: 'No orders in this period.' },
      { kind: 'bars', title: 'Spending per day', subtitle: 'Paid orders, by order date', money: true, columns: dailyColumns(d.daily, 'spent'), series: [{ label: 'Spent', tone: 'role-2' }], empty: 'Nothing was paid for in this period.' },
      { kind: 'hbar', title: 'Spending by supplier', subtitle: 'Paid orders', money: true, items: d.bySupplier.slice(0, 8).map((s) => ({ label: s.supplier, value: s.spent, tone: 'role-2', detail: `${count(s.orders)} ${s.orders === 1 ? 'order' : 'orders'}` })), empty: 'No orders in this period.' },
      { kind: 'hbar', title: 'Spending by branch', subtitle: 'Paid orders, by the branch they were bought for', money: true, items: d.byBranch.map((b) => ({ label: b.branch, value: b.spent, tone: 'role-1', detail: `${count(b.orders)} ${b.orders === 1 ? 'order' : 'orders'}` })), empty: 'Nothing was paid for in this period.' }
    ],
    tables: [
      {
        title: 'Suppliers',
        columns: [{ label: 'Supplier' }, { label: 'Orders', align: 'right' }, { label: 'Units bought', align: 'right' }, { label: 'Spent', align: 'right' }],
        rows: d.bySupplier.map((s) => [s.supplier, count(s.orders), count(s.units), money(s.spent)]),
        empty: 'No orders in this period.'
      },
      {
        title: 'Every order',
        columns: [{ label: 'Order' }, { label: 'Ordered' }, { label: 'Branch' }, { label: 'Supplier' }, { label: 'Product' }, { label: 'Qty', align: 'right' }, { label: 'Unit Price', align: 'right' }, { label: 'Total', align: 'right' }, { label: 'Stage' }, { label: 'Ordered by' }],
        rows: d.rows.map((r) => [r.id, dateTime(r.at), r.branch, r.supplier, r.product, count(r.qty), money(r.unitPrice), money(r.total), r.stage + (r.batch ? ` (${r.batch})` : ''), r.orderedBy || '—']),
        empty: 'No orders in this period.'
      }
    ]
  }
}
