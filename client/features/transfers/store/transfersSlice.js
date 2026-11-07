import { createSlice } from '@reduxjs/toolkit'

// Stock transfers between branches (loaded from the API)
const transfersSlice = createSlice({
  name: 'transfers',
  initialState: { items: [] },
  reducers: {
    transfersLoaded(state, action) {
      state.items = action.payload
    },
    // Added on top, or replaced when it was received
    transferSaved(state, action) {
      const index = state.items.findIndex((t) => t.id === action.payload.id)
      if (index === -1) state.items.unshift(action.payload)
      else state.items[index] = action.payload
    }
  }
})

export const { transfersLoaded, transferSaved } = transfersSlice.actions
export const selectTransfers = (state) => state.transfers.items
export default transfersSlice.reducer
