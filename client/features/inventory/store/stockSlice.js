import { createSlice } from '@reduxjs/toolkit'

// Each branch's stock as the server holds it, one row per batch of a product, newest first:
// { stockId, medId, branchId, batch, expiry, stock, receivedAt }
const stockSlice = createSlice({
  name: 'stock',
  initialState: [],
  reducers: {
    // Everything the user may see, from GET /stock
    stockLoaded(_state, action) {
      return action.payload
    },
    // Batches that just changed (pushed live, or returned by a save): replaced in place; new ones go to the top
    stockBatchesChanged(state, action) {
      const fresh = []
      for (const row of action.payload) {
        const index = state.findIndex((r) => r.stockId === row.stockId)
        if (index === -1) fresh.push(row)
        else state[index] = row
      }
      if (fresh.length) return [...fresh, ...state]
    }
  }
})

export const { stockLoaded, stockBatchesChanged } = stockSlice.actions
export const selectStockLevels = (state) => state.stock
export default stockSlice.reducer
