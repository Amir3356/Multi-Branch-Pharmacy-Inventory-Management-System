import { thunkContext } from '../../../redux/thunkHelpers'
import { refreshStock } from '../../inventory/store/stockThunks'
import { createDamagedItem, fetchDamagedItems } from '../../../api/damagedApi'
import { toDamagePayload } from '../model/damageRecord'
import { damageSaved, damagedLoaded } from './damagedSlice'

// Damaged stock is written off: it leaves the branch's sellable stock and is kept as a loss record. Thunks call the API;
// failures throw ApiError

export const loadDamaged = () => async (dispatch) => {
  const { data } = await fetchDamagedItems()
  dispatch(damagedLoaded(data))
}

// Recorded on another screen at this branch (its stock arrives separately, from the server)
export const damagePushed = (item) => (dispatch) => {
  dispatch(damageSaved(item))
}

// Inventory Officer: writes off damaged units from one batch at their branch
export const recordDamage = (data) => async (dispatch, getState) => {
  const { damagedItem } = await createDamagedItem(toDamagePayload(data))
  dispatch(damageSaved(damagedItem))
  dispatch(refreshStock())
  const { money, branchName } = thunkContext(getState)
  return `${damagedItem.id} recorded: ${damagedItem.qty} × ${damagedItem.product} removed from ${branchName(damagedItem.branchId)} stock (${money(damagedItem.lossValue)} loss).`
}
