import { createSlice } from '@reduxjs/toolkit'

// Sales (loaded from the API)
const salesSlice = createSlice({
  name: 'sales',
  initialState: { items: [] },
  reducers: {
    salesLoaded(state, action) {
      state.items = action.payload
    },
    // New sales go to the top of the list
    saleSaved(state, action) {
      if (!state.items.some((s) => s.id === action.payload.id)) state.items.unshift(action.payload)
    }
  }
})

export const { salesLoaded, saleSaved } = salesSlice.actions
export const selectSales = (state) => state.sales.items
export default salesSlice.reducer
