import { findCatalogProduct, nextId } from '../../../utils'
import { fetchStock } from '../../../api/stockApi'
import { categoryAdded, productAdded } from './productsSlice'
import { stockBatchesChanged, stockLoaded } from './stockSlice'

// The catalog product a server batch belongs to; a product this browser's catalog doesn't have yet (bought for the
// first time) is added, as when its order was paid
const catalogIdFor = (batch) => (dispatch, getState) => {
  const { products, settings } = getState()
  const found = findCatalogProduct(products.items, batch.medId, batch.product)
  if (found) return found.id
  const id = nextId(products.items, 'MED')
  dispatch(categoryAdded(batch.category))
  dispatch(productAdded({ id, name: batch.product, category: batch.category, purchasePrice: null, sellingPrice: null, reorderLevel: settings.defaultMinStock }))
  return id
}

const toRows = (batches) => (dispatch) =>
  // stockId, not id: Inventory rows are { ...product, ...stock row }, so the product keeps its own id
  batches.map(({ id, branchId, batch, expiry, stock, receivedAt, ...product }) => ({
    stockId: id,
    medId: dispatch(catalogIdFor(product)),
    branchId,
    batch,
    expiry,
    stock,
    receivedAt
  }))

// Every batch the user may see; load the catalog first so batches find their products. Throws ApiError.
export const loadStock = () => async (dispatch) => {
  const { data } = await fetchStock()
  dispatch(stockLoaded(dispatch(toRows(data))))
}

// Batches another screen changed (pushed over the WebSocket), or a save returned
export const stockPushed = (batches) => (dispatch) => {
  dispatch(stockBatchesChanged(dispatch(toRows(batches))))
}

// After this screen saves something that moves stock: the live push updates every screen, but if the WebSocket is
// down this screen still shows the right figures
export const refreshStock = () => (dispatch) => dispatch(loadStock()).catch(() => {})
