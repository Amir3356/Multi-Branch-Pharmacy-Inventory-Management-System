import { count, dailyColumns, dateTime, foldSlices } from './common'

/** Sales Report: revenue and transactions for the period, where and by whom, and the best-selling products */
export function salesSpec(d, money) {
  const t = d.totals
  return {
    cards: [
      { title: 'Revenue', icon: 'revenue', tone: 'cyan', value: money(t.revenue), chip: `${count(t.transactions)} ${t.transactions === 1 ? 'sale' : 'sales'}` },
      { title: 'Units Sold', icon: 'units', tone: 'teal', value: count(t.units), chip: `Average sale ${money(t.averageSale)}` },
      // Cost and profit only come for the Owner (they use purchase prices)
      ...(t.costOfSales === undefined ? [] : [
        { title: 'Cost of Goods Sold', icon: 'cost', tone: 'warning', value: money(t.costOfSales), chip: 'At purchase price' },
        { title: 'Gross Profit', icon: 'profit', tone: 'teal', value: money(t.grossProfit), chip: 'Revenue − cost of goods', chipTone: t.grossProfit >= 0 ? 'positive' : 'negative' }
      ])
    ],
    charts: [
      { kind: 'bars', title: 'Revenue per day', subtitle: 'Each day of the period with sales', money: true, columns: dailyColumns(d.daily, 'revenue'), series: [{ label: 'Revenue', tone: 'role-1' }], empty: 'No sales in this period.' },
      { kind: 'pie', title: 'Revenue by category', subtitle: 'Share of revenue', money: true, items: foldSlices(d.byCategory.map((c) => ({ label: c.category, value: c.revenue }))), empty: 'No sales in this period.' },
      { kind: 'hbar', title: 'Revenue by branch', subtitle: `${d.byBranch.length} ${d.byBranch.length === 1 ? 'branch' : 'branches'} with sales`, money: true, items: d.byBranch.map((b) => ({ label: b.branch, value: b.revenue, tone: 'role-1', detail: `${count(b.transactions)} sales` })), empty: 'No sales in this period.' },
      { kind: 'hbar', title: 'Top products', subtitle: 'By revenue', money: true, items: d.topProducts.slice(0, 8).map((p) => ({ label: p.product, value: p.revenue, tone: 'role-3', detail: `${count(p.units)} units` })), empty: 'No sales in this period.' }
    ],
    tables: [
      {
        title: 'Sales by cashier',
        columns: [{ label: 'Cashier' }, { label: 'Branch' }, { label: 'Sales', align: 'right' }, { label: 'Units', align: 'right' }, { label: 'Revenue', align: 'right' }],
        rows: d.byCashier.map((c) => [c.cashier, c.branch || '—', count(c.transactions), count(c.units), money(c.revenue)]),
        empty: 'No sales in this period.'
      },
      {
        title: 'Top products',
        columns: [{ label: 'Product' }, { label: 'Category' }, { label: 'Sales', align: 'right' }, { label: 'Units', align: 'right' }, { label: 'Revenue', align: 'right' }],
        rows: d.topProducts.map((p) => [p.product, p.category, count(p.transactions), count(p.units), money(p.revenue)]),
        empty: 'No sales in this period.'
      },
      {
        title: 'Every sale',
        note: d.rowsTotal > d.rows.length ? `Showing the latest ${count(d.rows.length)} of ${count(d.rowsTotal)} sales` : null,
        columns: [{ label: 'Sale' }, { label: 'Date & Time' }, { label: 'Branch' }, { label: 'Cashier' }, { label: 'Customer' }, { label: 'Product' }, { label: 'Qty', align: 'right' }, { label: 'Unit Price', align: 'right' }, { label: 'Total', align: 'right' }],
        rows: d.rows.map((r) => [r.id, dateTime(r.at), r.branch, r.cashier, r.customer, r.product, count(r.qty), money(r.unitPrice), money(r.total)]),
        empty: 'No sales in this period.'
      }
    ]
  }
}
