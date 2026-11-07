import { useState } from 'react'
import { todayKey } from '../../../utils'
import { PERIODS, periodLabel, periodRange } from '../services/periods'

/** The dashboard's chosen period (This Month by default), with From/To for a custom range */
export function usePeriod() {
  const [period, setPeriod] = useState('monthly')
  const [custom, setCustom] = useState(() => ({ from: `${todayKey().slice(0, 7)}-01`, to: todayKey() }))
  const invalid = period === 'custom' && (!custom.from || !custom.to || custom.from > custom.to)
  const range = periodRange(period, custom.from, custom.to)
  return {
    period,
    setPeriod,
    custom,
    setCustom,
    invalid,
    range,
    // "This Month", or the dates of a custom range
    name: period === 'custom' ? periodLabel(...range) : PERIODS[period],
    // "Oct 1, 2026 – Oct 10, 2026"
    text: periodLabel(...range)
  }
}
