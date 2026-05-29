import { createSlice } from '@reduxjs/toolkit'

// Product categories start empty and populate from the database / API
const CATEGORIES = []

// The product catalog shared by every branch (loaded from the server), plus its categories. Prices are added here as
// stock arrives (purchase price) and is set up for sale (selling price).
const productsSlice = createSlice({
  name: 'products',
  initialState: { items: [], categories: CATEGORIES },
  reducers: {
    // The server's catalog: products keep any prices this browser already knows
    productsLoaded(state, action) {
      const known = Object.fromEntries(state.items.map((p) => [p.id, p]))
      const fromServer = action.payload.map((p) => ({ purchasePrice: null, sellingPrice: null, ...known[p.id], ...p }))
      const serverIds = new Set(action.payload.map((p) => p.id))
      state.items = [...fromServer, ...state.items.filter((p) => !serverIds.has(p.id))]
      for (const p of action.payload) if (!state.categories.includes(p.category)) state.categories.push(p.category)
    },
    productAdded(state, action) {
      state.items.push(action.payload)
    },
    productUpdated(state, action) {
      const product = state.items.find((p) => p.id === action.payload.id)
      if (product) Object.assign(product, action.payload.changes)
    },
    // Deleted on the Products page (loading the catalog keeps products it doesn't list, so drop it here)
    productRemoved(state, action) {
      state.items = state.items.filter((p) => p.id !== action.payload)
    },
    categoryAdded(state, action) {
      if (!state.categories.includes(action.payload)) state.categories.push(action.payload)
    }
  }
})

export const { productsLoaded, productAdded, productUpdated, productRemoved, categoryAdded } = productsSlice.actions
export const selectProducts = (state) => state.products.items
export const selectCategories = (state) => state.products.categories
export default productsSlice.reducer
