import { createSlice } from '@reduxjs/toolkit'

// Pharmacy branches, loaded from the API (the Owner creates them from the Branches page)
const branchesSlice = createSlice({
  name: 'branches',
  initialState: [],
  reducers: {
    branchesLoaded(state, action) {
      return action.payload
    },
    // Added or updated
    branchSaved(state, action) {
      const index = state.findIndex((b) => b.id === action.payload.id)
      if (index === -1) state.push(action.payload)
      else state[index] = action.payload
    },
    branchRemoved(state, action) {
      return state.filter((b) => b.id !== action.payload)
    }
  }
})

export const { branchesLoaded, branchSaved, branchRemoved } = branchesSlice.actions
export const selectBranches = (state) => state.branches
export default branchesSlice.reducer
