import { change, count, date, dayLabel, foldSlices, percent } from './common'

/** Financial Report: profit and loss for the period, where the money went, and the change from the period before */
export function financialSpec(d, money) {
  const t = d.totals
  const p = d.previous
  const vs = (now, before) => change(now, before)
  const revenueChange = vs(t.revenue, p.revenue)
  const netChange = vs(t.netProfit, p.netProfit)
  const expenseEntries = d.expensesByCategory.reduce((n, e) => n + e.entries, 0)
  const damagedUnits = d.damageByReason.reduce((n, r) => n + r.units, 0)
  return {
    note: `Compared with the previous period: ${date(p.from)} – ${date(p.to)}`,
    cards: [
      { title: 'Revenue', icon: 'revenue', tone: 'cyan', value: money(t.revenue), chip: revenueChange?.text || 'Sales in the period', chipTone: revenueChange?.tone || 'neutral' },
      { title: 'Expenses', icon: 'cost', tone: 'warning', value: money(t.expenses), chip: `${count(expenseEntries)} ${expenseEntries === 1 ? 'entry' : 'entries'}` },
      { title: 'Damage Losses', icon: 'low', tone: 'danger', value: money(t.damageLoss), chip: `${count(damagedUnits)} ${damagedUnits === 1 ? 'unit' : 'units'} written off`, chipTone: t.damageLoss ? 'negative' : 'positive' },
      { title: 'Net Profit', icon: 'net', tone: t.netProfit >= 0 ? 'teal' : 'danger', value: money(t.netProfit), chip: netChange?.text || `Net margin ${percent(t.netMargin)}`, chipTone: netChange?.tone || (t.netProfit >= 0 ? 'positive' : 'negative') }
    ],
    charts: [
      {
        kind: 'bars',
        title: 'Money in and out per day',
        subtitle: 'Days with any activity',
        money: true,
        columns: d.daily.map((day) => ({ label: dayLabel(day.date), title: date(day.date), values: [day.sales, day.purchases, day.expenses] })),
        series: [{ label: 'Sales', tone: 'role-1' }, { label: 'Purchases', tone: 'role-2' }, { label: 'Expenses', tone: 'role-3' }],
        empty: 'No money moved in this period.'
      },
      { kind: 'pie', title: 'Where the money went', subtitle: 'Cost of goods, expenses and damage', money: true, items: foldSlices([{ label: 'Cost of goods sold', value: t.costOfSales }, { label: 'Expenses', value: t.expenses }, { label: 'Damage losses', value: t.damageLoss }]), empty: 'No costs in this period.' },
      { kind: 'hbar', title: 'Expenses by category', subtitle: `${money(t.expenses)} in total`, money: true, items: d.expensesByCategory.map((e) => ({ label: e.category, value: e.amount, tone: 'role-3', detail: `${count(e.entries)} ${e.entries === 1 ? 'entry' : 'entries'}` })), empty: 'No expenses in this period.' },
      { kind: 'hbar', title: 'Revenue by branch', subtitle: 'Net profit shown beside each', money: true, items: d.byBranch.map((b) => ({ label: b.branch, value: b.revenue, tone: 'role-1', detail: `net ${money(b.netProfit)}` })), empty: 'No branches.' }
    ],
    tables: [
      {
        title: 'Profit and loss',
        columns: [{ label: 'Line' }, { label: 'This period', align: 'right' }, { label: 'Previous period', align: 'right' }, { label: 'Share of revenue', align: 'right' }],
        rows: [
          ['Revenue (sales)', money(t.revenue), money(p.revenue), t.revenue ? '100%' : '—'],
          ['− Cost of goods sold', money(t.costOfSales), '—', percent(t.revenue ? (t.costOfSales / t.revenue) * 100 : null)],
          ['= Gross profit', money(t.grossProfit), money(p.grossProfit), percent(t.grossMargin)],
          ['− Expenses', money(t.expenses), money(p.expenses), percent(t.revenue ? (t.expenses / t.revenue) * 100 : null)],
          ['− Damage losses', money(t.damageLoss), '—', percent(t.revenue ? (t.damageLoss / t.revenue) * 100 : null)],
          ['= Net profit', money(t.netProfit), money(p.netProfit), percent(t.netMargin)]
        ],
        strongRows: [2, 5],
        footnote: `Stock bought in the period (purchases): ${money(t.purchases)}. It becomes a cost only when sold, as cost of goods sold.`
      },
      {
        title: 'Branches',
        columns: [{ label: 'Branch' }, { label: 'Revenue', align: 'right' }, { label: 'Expenses', align: 'right' }, { label: 'Damage losses', align: 'right' }, { label: 'Net profit', align: 'right' }],
        rows: d.byBranch.map((b) => [b.branch, money(b.revenue), money(b.expenses), money(b.damageLoss), money(b.netProfit)]),
        empty: 'No branches.'
      },
      {
        title: 'Damage losses by reason',
        columns: [{ label: 'Reason' }, { label: 'Units', align: 'right' }, { label: 'Loss', align: 'right' }],
        rows: d.damageByReason.map((r) => [r.reason, count(r.units), money(r.loss)]),
        empty: 'No damage in this period.'
      },
      {
        title: 'Every expense',
        columns: [{ label: 'Expense' }, { label: 'Date' }, { label: 'Branch' }, { label: 'Category' }, { label: 'Description' }, { label: 'Recorded by' }, { label: 'Amount', align: 'right' }],
        rows: d.expenses.map((e) => [e.id, date(e.date), e.branch || '—', e.category, e.description || '—', e.recordedBy || '—', money(e.amount)]),
        empty: 'No expenses in this period.'
      }
    ]
  }
}
