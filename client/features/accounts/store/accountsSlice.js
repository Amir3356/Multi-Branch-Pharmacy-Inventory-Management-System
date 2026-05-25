import { createSlice } from '@reduxjs/toolkit'

// Staff login accounts (Owner, Inventory Officer, Cashier, Purchase Officer), loaded from the API
const accountsSlice = createSlice({
  name: 'accounts',
  initialState: [],
  reducers: {
    accountsLoaded(state, action) {
      return action.payload
    },
    // Added or updated
    accountSaved(state, action) {
      const index = state.findIndex((a) => a.id === action.payload.id)
      if (index === -1) state.push(action.payload)
      else state[index] = action.payload
    },
    accountRemoved(state, action) {
      return state.filter((a) => a.id !== action.payload)
    }
  }
})

export const { accountsLoaded, accountSaved, accountRemoved } = accountsSlice.actions
export const selectAccounts = (state) => state.accounts
export default accountsSlice.reducer
