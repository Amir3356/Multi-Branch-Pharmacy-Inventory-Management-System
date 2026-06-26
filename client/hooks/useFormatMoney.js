import { useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { formatAmount, formatMoneyIn } from '../utils'
import { selectSettings } from '../features/policy/store/settingsSlice'

// formatMoney(value) in the store's configured currency
export function useFormatMoney() {
  const { currency } = useSelector(selectSettings)
  return useCallback((value) => formatMoneyIn(currency, value), [currency])
}

// Money table columns: the currency goes in the header once ("Total Cost (ETB)") and cells show the amount alone
export function useMoneyColumns() {
  const { currency } = useSelector(selectSettings)
  return useMemo(() => ({ moneyHeader: (label) => `${label} (${currency})`, formatAmount }), [currency])
}
