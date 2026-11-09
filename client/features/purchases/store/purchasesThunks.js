import { createProcurement, fetchProcurements, receiveProcurement } from '../../../api/procurementsApi'
import { findCatalogProduct, nextId } from '../../../utils'
import { thunkContext } from '../../../redux/thunkHelpers'
import { categoryAdded, productAdded, productUpdated } from '../../inventory/store/productsSlice'
import { refreshStock } from '../../inventory/store/stockThunks'
import { loadProducts } from '../../inventory/store/productsThunks'
import { procurementBatch } from '../model/procurement'
import { purchaseSaved } from './purchasesSlice'

// Procurements live on the server and are recorded already paid. Recording one puts the product in the catalog; its stock enters
// the receiving branch's Inventory (on the server) only when that branch's Inventory Officer adds it (Receive Stock).

// The catalog product a paid order bought; a product new to the catalog is added (selling price set with Receive Stock)
const productFor = (procurement) => (dispatch, getState) => {
  const { state } = thunkContext(getState)
  const { category, product, purchasePrice } = procurement
  dispatch(categoryAdded(category))
  let medId = findCatalogProduct(state.products.items, procurement.medId, product)?.id
  if (!medId) {
    medId = nextId(state.products.items, 'MED')
    dispatch(productAdded({ id: medId, name: product, category, purchasePrice, sellingPrice: null, reorderLevel: state.settings.defaultMinStock }))
  }
  return medId
}

// Paid: the product is ready for Receive Stock at the receiving branch, but nothing is in stock yet. Its Batch ID is
// now Paid and can't be bought again: the catalog is reloaded so Create Procurement shows it as Paid.
const procurementPaid = (procurement) => (dispatch) => {
  dispatch(productFor(procurement))
  if (procurement.batch) dispatch(loadProducts()).catch(() => {})
}

// Keeps the browser's copy in step with the API's
const procurementSynced = (procurement) => (dispatch, getState) => {
  const known = getState().purchases.items.find((p) => p.id === procurement.id)
  dispatch(purchaseSaved(procurement))
  if (procurement.status === 'Paid' && known?.status !== 'Paid') dispatch(procurementPaid(procurement))
  // Added with Receive Stock: the product is in the catalog (its units are in the server's stock)
  if (procurement.receivedAt && !known?.receivedAt) dispatch(productFor(procurement))
}

// Inventory Officer (Receive Stock): add a paid order's stock to their branch with the expiry on the package (the server
// generates its batch number), and set its selling price; returns the confirmation, or throws ApiError (e.g. already added on another screen)
export const addProcurementToStock = (procurement, sellingPrice, { expiryDate }) => async (dispatch, getState) => {
  // The server saves the product's shared prices too (this order's unit cost, and the selling price)
  const { procurement: received } = await receiveProcurement(procurement.id, { expiryDate, sellingPrice })
  dispatch(procurementSynced(received))
  dispatch(refreshStock())
  const { state, money, branchName } = thunkContext(getState)
  const product = findCatalogProduct(state.products.items, received.medId, received.product)
  dispatch(productUpdated({ id: product.id, changes: { purchasePrice: received.purchasePrice, sellingPrice } }))
  const where = branchName(received.branchId)
  return `${received.qty} × ${received.product} added to ${where ? `${where}'s` : 'your branch’s'} stock as batch ${procurementBatch(received)}, at ${money(sellingPrice)} per unit.`
}

// A procurement pushed over the WebSocket (recorded, or added to stock): its receiving branch's Inventory sees it at
// once, and only once
export const procurementPushed = (procurement) => (dispatch) => dispatch(procurementSynced(procurement))

export const loadProcurements = () => async (dispatch) => {
  const { data } = await fetchProcurements()
  // Oldest first, so each one lands on top of the list in date order
  ;[...data].reverse().forEach((procurement) => dispatch(procurementSynced(procurement)))
}

// Records a paid order and returns the API's confirmation; failures throw ApiError. `idempotencyKey` stays the same for
// every try of one order, so a retry can't record it twice.
export const recordProcurement = (data, idempotencyKey) => async (dispatch, getState) => {
  const { currency } = getState().settings
  const { procurement, message } = await createProcurement({ ...data, currency }, idempotencyKey)
  dispatch(procurementSynced(procurement))
  return message
}
