import { createSlice } from '@reduxjs/toolkit'
import { STORAGE_KEYS, readJson } from '../../../utils'

const USD_TO_ETB = 161

export const DEFAULT_SETTINGS = {
  storeName: 'SuperMart IMS',
  currency: 'ETB',
  defaultBranch: 'all',
  expiryWarningDays: 60,
  lowStockAlerts: true,
  // One minimum stock level for every product at all branches (set on the Policy page)
  defaultMinStock: 20,
  expiryAlerts: true,
  reorderLevels: {},
  tax: { version: 3, rates: [] },
  expenseCategories: [],
  maxTransferQty: 500
}

// Earlier versions also stored sales taxes and a tax type. Only yearly government taxes
// with a percentage rate are kept (fixed annual fees are not percentages, so they are dropped).
const migrateTaxRates = (rates = []) =>
  rates
    .filter((r) => ['Annual', 'Profit', 'Turnover'].includes(r.type))
    .map((r) => ({ id: r.id, name: r.name, rate: Number(r.rate) || 0, dueMonth: r.dueMonth || 10, dueDay: r.dueDay || 31, status: r.status || 'Active' }))

// Saved settings from this browser, merged over the defaults
const loadSettings = () => {
  const saved = readJson(STORAGE_KEYS.settings)
  if (!saved) return DEFAULT_SETTINGS
  const merged = {
    ...DEFAULT_SETTINGS,
    ...saved,
    reorderLevels: { ...DEFAULT_SETTINGS.reorderLevels, ...saved.reorderLevels },
    tax: saved.tax?.version === 3 ? saved.tax : DEFAULT_SETTINGS.tax,
    expenseCategories: saved.expenseCategories || DEFAULT_SETTINGS.expenseCategories
  }
  if (saved.tax && saved.tax.version !== 3) {
    const migrated = migrateTaxRates(saved.tax.rates)
    if (migrated.length) merged.tax = { version: 3, rates: migrated }
  }
  // Prices became Ethiopian Birr (1 USD = 161 ETB): settings saved while the app was in dollars move to birr too
  if (saved.currency !== 'ETB') {
    merged.currency = 'ETB'
    if (saved.expenseCategories) {
      merged.expenseCategories = saved.expenseCategories.map((c) => ({ ...c, amount: Math.round(c.amount * USD_TO_ETB * 100) / 100 }))
    }
  }
  delete merged.taxPayments // annual tax payment tracking was removed
  delete merged.taxRate // replaced by the tax configuration
  return merged
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState: loadSettings,
  reducers: {
    // The shared policy from the server (on load, after saving, or pushed when someone else saves it)
    policyLoaded(state, action) {
      state.defaultMinStock = action.payload.defaultMinStock
      state.expiryWarningDays = action.payload.expiryWarningDays
      state.policyUpdatedBy = action.payload.updatedBy
      state.policyUpdatedAt = action.payload.updatedAt
    }
  }
})

export const { policyLoaded } = settingsSlice.actions
export const selectSettings = (state) => state.settings
export default settingsSlice.reducer
