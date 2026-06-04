import { createSlice } from '@reduxjs/toolkit'

const upsert = (list, record) => {
  const index = list.findIndex((item) => item.id === record.id)
  if (index === -1) list.unshift(record)
  else list[index] = record
}

// Purchases from suppliers (procurements)
const purchasesSlice = createSlice({
  name: 'purchases',
  initialState: { items: [] },
  reducers: {
    // Added, or replaced when the API sends a newer copy (e.g. Pending → Paid)
    purchaseSaved(state, action) {
      upsert(state.items, action.payload)
    }
  }
})

export const { purchaseSaved } = purchasesSlice.actions
export const selectPurchases = (state) => state.purchases.items
export default purchasesSlice.reducer
