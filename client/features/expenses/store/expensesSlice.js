import { createSlice } from '@reduxjs/toolkit'

// Branch expenses (loaded from the API)
const expensesSlice = createSlice({
  name: 'expenses',
  initialState: [],
  reducers: {
    expensesLoaded(state, action) {
      return action.payload
    }
  }
})

export const { expensesLoaded } = expensesSlice.actions
export const selectExpenses = (state) => state.expenses
export default expensesSlice.reducer
