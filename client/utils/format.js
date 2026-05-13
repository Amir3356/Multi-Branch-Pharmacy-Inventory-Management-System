// Formatting and small value checks shared across the app

export const CURRENCIES = {
  USD: { symbol: '$', label: 'US Dollar ($)' },
  ETB: { symbol: 'ETB ', label: 'Ethiopian Birr (ETB)' },
  EUR: { symbol: '€', label: 'Euro (€)' }
}

/** "ETB 1,234.50" / "-ETB 12.00" in the given currency */
export const formatMoneyIn = (currency, value) =>
  `${value < 0 ? '-' : ''}${CURRENCIES[currency]?.symbol || '$'}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** 1234.5 → "1,234.50": the amount alone, for table cells whose column header names the currency */
export const formatAmount = (value) =>
  `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Case-insensitive comparison of two names */
export const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The catalog product a record refers to: by its product id first, by name only when it has none (two products
 * can share a name, so a name match must never win over the id) */
export const findCatalogProduct = (products, medId, name) =>
  (medId && products.find((p) => p.id === medId)) || (name ? products.find((p) => sameText(p.name, name)) : undefined)

export const isWholeNumber = (value, min, max = Infinity) =>
  Number.isInteger(Number(value)) && value !== '' && Number(value) >= min && Number(value) <= max

export const plural = (count, one, many) => (count === 1 ? one : many)
