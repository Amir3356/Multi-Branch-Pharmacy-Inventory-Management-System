import { createSlice } from '@reduxjs/toolkit'

// Damaged items (loaded from the API)
const damagedSlice = createSlice({
  name: 'damaged',
  initialState: { items: [] },
  reducers: {
    damagedLoaded(state, action) {
      state.items = action.payload
    },
    // New records go to the top of the list
    damageSaved(state, action) {
      if (!state.items.some((d) => d.id === action.payload.id)) state.items.unshift(action.payload)
    }
  }
})

export const { damagedLoaded, damageSaved } = damagedSlice.actions
export const selectDamaged = (state) => state.damaged.items
export default damagedSlice.reducer
