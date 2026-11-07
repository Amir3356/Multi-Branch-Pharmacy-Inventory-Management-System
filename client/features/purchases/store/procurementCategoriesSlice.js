import { createSlice } from '@reduxjs/toolkit'

// Procurement categories (loaded from the API): kept on the Categories page, picked in Create Procurement
const procurementCategoriesSlice = createSlice({
  name: 'procurementCategories',
  initialState: [],
  reducers: {
    procurementCategoriesLoaded(state, action) {
      return action.payload
    }
  }
})

export const { procurementCategoriesLoaded } = procurementCategoriesSlice.actions
/** @returns {{ id: number, name: string, createdAt: string | null }[]} A to Z */
export const selectProcurementCategories = (state) => state.procurementCategories
export default procurementCategoriesSlice.reducer
