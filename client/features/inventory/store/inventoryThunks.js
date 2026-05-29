import { updateSellingPrice } from '../../../api/productsApi'
import { correctStockBatch } from '../../../api/stockApi'
import { thunkContext } from '../../../redux/thunkHelpers'
import { productUpdated } from './productsSlice'
import { stockPushed } from './stockThunks'

// Edit one branch's stock row. The counted units and expiry are corrected on the server, checked against what this
// screen showed (a sale made meanwhile makes it refuse with 409 instead of being undone); prices are stored on the
// product, so they change at every branch. Throws ApiError.
export const editInventoryItem = (item, data) => async (dispatch, getState) => {
  const { money, branchName } = thunkContext(getState)
  const stockChanged = data.stock !== item.stock || data.expiry !== item.expiry
  if (stockChanged) {
    const { batch } = await correctStockBatch(item.stockId, { stock: data.stock, expiry: data.expiry, expectedStock: item.stock })
    dispatch(stockPushed([batch]))
  }
  if (data.sellingPrice !== item.sellingPrice) await updateSellingPrice(item.medId, data.sellingPrice)
  dispatch(productUpdated({ id: item.medId, changes: { purchasePrice: data.purchasePrice, sellingPrice: data.sellingPrice } }))
  const changes = [
    data.stock !== item.stock && `stock ${item.stock} → ${data.stock}`,
    data.expiry !== item.expiry && `expiry ${item.expiry} → ${data.expiry}`,
    data.purchasePrice !== item.purchasePrice && `purchase price ${money(item.purchasePrice)} → ${money(data.purchasePrice)}`,
    data.sellingPrice !== item.sellingPrice && `selling price ${item.sellingPrice == null ? 'not set' : money(item.sellingPrice)} → ${money(data.sellingPrice)}`
  ].filter(Boolean)
  const where = `${item.name} at ${branchName(item.branchId)}`
  return changes.length ? `${where} was updated.` : 'No changes to save.'
}
