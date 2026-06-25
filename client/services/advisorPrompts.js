// The Owner's AI business advisor: one-tap analyses for the sidebar chat. Each runs on the dashboard's period and
// branch, which the server adds to the figures the AI sees.

export const ADVISOR_ANALYSES = [
  {
    label: 'Financial summary',
    prompt:
      'Give me a financial summary for this period: revenue, cost of sales, expenses, purchases, damage losses, gross and net profit, ' +
      'and margins, each compared with the previous period. Point out the trends that affect profit most.'
  },
  {
    label: 'Compare branches',
    prompt:
      'Compare all branches on revenue, net profit, margin, expenses, damage losses and stock health. Which branch performs best and ' +
      'which worst, why, and what should each one do to improve?'
  },
  {
    label: 'Forecast',
    prompt:
      'Forecast the next 30 days: expected revenue (per branch), expenses and profit, products likely to run out and when, what to ' +
      'reorder, and stock likely to expire unsold. Say what each forecast is based on and how confident it is.'
  },
  {
    label: 'Restock & overstock',
    prompt:
      'Which products should I restock first, and how many? Which products are overstocked or not selling, how much money is tied up ' +
      'in them, and what should I do with them (transfer, promote, stop buying)?'
  },
  {
    label: 'Cut costs & losses',
    prompt:
      'Where can I cut costs? Look at expenses by category, damage and expiry losses by reason, and supplier prices. Give specific ' +
      'savings with amounts.'
  },
  {
    label: 'Audit review',
    prompt:
      'Review the audit trail for this period. Explain each flagged event, why it matters and what I should check, and tell me whether ' +
      'any staff activity looks unusual. If nothing is flagged, say so and summarise the activity.'
  },
  {
    label: 'Grow revenue',
    prompt:
      'What are the best ways to grow revenue and profit from here? Use best sellers, slow sellers, branch differences and margins, ' +
      'and give concrete steps.'
  }
]

// Shown before the first question
export const ADVISOR_STARTERS = ['What needs my attention right now?', 'Why did profit change from the previous period?', 'Is anything unusual happening at my branches?']

// How serious a flagged audit event or a recommendation is, as a <StatusTag> colour
export const SEVERITY_TONE = { high: 'out-of-stock', medium: 'low-stock', low: 'inactive' }
export const SEVERITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }
