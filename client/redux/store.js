import { configureStore } from '@reduxjs/toolkit'
import { onUnauthorized, setAuthToken } from '../utils/http'
import { STORAGE_KEYS, writeJson } from '../utils'
import authReducer, { sessionEnded } from '../features/auth/store/authSlice'
import settingsReducer from '../features/policy/store/settingsSlice'
import branchesReducer from '../features/branches/store/branchesSlice'
import productsReducer from '../features/inventory/store/productsSlice'
import stockReducer from '../features/inventory/store/stockSlice'
import salesReducer from '../features/sales/store/salesSlice'
import purchasesReducer from '../features/purchases/store/purchasesSlice'
import procurementCategoriesReducer from '../features/purchases/store/procurementCategoriesSlice'
import transfersReducer from '../features/transfers/store/transfersSlice'
import expensesReducer from '../features/expenses/store/expensesSlice'
import damagedReducer from '../features/damaged/store/damagedSlice'
import accountsReducer from '../features/accounts/store/accountsSlice'
import sessionsReducer from '../features/accounts/store/sessionsSlice'
import notificationsReducer from '../features/notifications/store/notificationsSlice'

// One store for all shared app data, loaded from the API
export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
    branches: branchesReducer,
    products: productsReducer,
    stock: stockReducer,
    sales: salesReducer,
    purchases: purchasesReducer,
    procurementCategories: procurementCategoriesReducer,
    transfers: transfersReducer,
    expenses: expensesReducer,
    damaged: damagedReducer,
    accounts: accountsReducer,
    sessions: sessionsReducer,
    notifications: notificationsReducer
  }
})

// API calls carry the signed-in user's token; a 401 means it expired or was revoked
setAuthToken(store.getState().auth.token)
onUnauthorized(() => store.dispatch(sessionEnded()))

// Per-viewer state survives a refresh: sign-in, policy settings, and notification read state
let previous = store.getState()
store.subscribe(() => {
  const state = store.getState()
  if (state.auth !== previous.auth) {
    setAuthToken(state.auth.token)
    writeJson(STORAGE_KEYS.auth, state.auth.token ? { token: state.auth.token, user: state.auth.user } : null)
  }
  if (state.settings !== previous.settings) writeJson(STORAGE_KEYS.settings, state.settings)
  if (state.notifications !== previous.notifications) writeJson(STORAGE_KEYS.notifications, state.notifications)
  previous = state
})
