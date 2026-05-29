import { createSelector } from '@reduxjs/toolkit'
import { buildInventory } from '../../../utils'
import { selectSettings } from '../../policy/store/settingsSlice'
import { selectStockLevels } from './stockSlice'
import { selectProducts } from './productsSlice'

// Inventory rows (product × branch) with stock status and expiry flags
export const selectInventory = createSelector([selectSettings, selectStockLevels, selectProducts], buildInventory)
