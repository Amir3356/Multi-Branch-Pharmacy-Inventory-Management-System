import { findCatalogProduct } from '../../../utils'
import { thunkContext } from '../../../redux/thunkHelpers'
import { productUpdated } from '../../inventory/store/productsSlice'
import { refreshStock } from '../../inventory/store/stockThunks'
import { createTransfer, fetchTransfers, receiveTransfer } from '../../../api/transfersApi'
import { transferSaved, transfersLoaded } from './transfersSlice'

// Transfer thunks call the API and return the confirmation message; failures throw ApiError

const productOf = (state, transfer) => findCatalogProduct(state.products.items, transfer.medId, transfer.product)

export const loadTransfers = () => async (dispatch) => {
  const { data } = await fetchTransfers()
  dispatch(transfersLoaded(data))
}

// Sent or received on another screen: shown here at once (its stock arrives separately, from the server)
export const transferPushed = (transfer) => (dispatch) => {
  dispatch(transferSaved(transfer))
}

// Inventory Officer: send stock to another branch. It leaves this branch now and is Pending until the receiving
// branch adds it with Receive Stock.
export const sendTransfer = ({ medId, expiry, ...data }) => async (dispatch) => {
  const { transfer, message } = await createTransfer({ ...data, medId, expiry })
  dispatch(transferSaved(transfer))
  dispatch(refreshStock())
  return message
}

// Receiving branch's Inventory Officer (Receive Stock): the units enter this branch's stock, and the product's selling
// price is set
export const receiveTransferToStock = (transfer, sellingPrice) => async (dispatch, getState) => {
  // The server saves the product's selling price too, for every branch
  const { transfer: received } = await receiveTransfer(transfer.id, sellingPrice)
  dispatch(transferSaved(received))
  dispatch(refreshStock())
  const { state, money, branchName } = thunkContext(getState)
  const product = productOf(state, received)
  if (product) dispatch(productUpdated({ id: product.id, changes: { sellingPrice } }))
  return `${received.qty} × ${received.product} from ${branchName(received.from) || 'the other branch'} added to stock as batch ${received.receivedBatch || received.batch}, at ${money(sellingPrice)} per unit.`
}
