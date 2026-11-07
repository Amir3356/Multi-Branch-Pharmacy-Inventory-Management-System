import { fetchPolicy, updatePolicy } from '../../../api/policyApi'
import { toPolicyPayload } from '../model/policy'
import { policyLoaded } from './settingsSlice'

// The policy lives on the server, so it is the same for every user, browser and branch

export const loadPolicy = () => async (dispatch) => {
  const { data } = await fetchPolicy()
  dispatch(policyLoaded(data))
}

// Saved on another screen: applied here at once (stock statuses are worked out from it)
export const policyPushed = (policy) => (dispatch) => dispatch(policyLoaded(policy))

// Inventory Officer (Policy page): saves both settings. Throws ApiError.
export const savePolicy = ({ minStock, expiryDays }) => async (dispatch) => {
  const { policy } = await updatePolicy(toPolicyPayload({ minStock, expiryDays }))
  dispatch(policyLoaded(policy))
}
