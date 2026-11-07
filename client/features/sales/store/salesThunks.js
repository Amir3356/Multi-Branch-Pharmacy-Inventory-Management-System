import { thunkContext } from '../../../redux/thunkHelpers'
import { refreshStock } from '../../inventory/store/stockThunks'
import { createSale, fetchSales } from '../../../api/salesApi'
import { toSalePayload } from '../model/sale'
import { saleSaved, salesLoaded } from './salesSlice'

// Sale thunks call the API; failures throw ApiError

export const loadSales = () => async (dispatch) => {
  const { data } = await fetchSales()
  dispatch(salesLoaded(data))
}

// Recorded on another screen at this branch (its stock arrives separately, from the server)
export const salePushed = (sale) => (dispatch) => {
  dispatch(saleSaved(sale))
}

// Cashier: records a sale at their branch; returns the sale and a confirmation. `idempotencyKey` stays the same for every
// try of one sale, so a retry after a lost response gets the recorded sale back instead of selling it twice.
export const recordSale = (data, idempotencyKey) => async (dispatch, getState) => {
  const { sale } = await createSale(toSalePayload(data), idempotencyKey)
  dispatch(saleSaved(sale))
  // The server took the units out of the batches; show its figures
  dispatch(refreshStock())
  const { money, branchName } = thunkContext(getState)
  return { sale, message: `Sale ${sale.id} recorded at ${branchName(sale.branchId) || 'your branch'}: ${sale.qty} × ${sale.product} for ${money(sale.total)}.` }
}
