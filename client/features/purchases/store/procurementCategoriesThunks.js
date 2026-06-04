import {
  createProcurementCategory,
  destroyProcurementCategory,
  fetchProcurementCategories,
  renameProcurementCategory
} from '../../../api/procurementCategoriesApi'
import { procurementCategoriesLoaded } from './procurementCategoriesSlice'

// Category thunks call the API and return its confirmation message; failures throw ApiError (field errors included)

export const loadProcurementCategories = () => async (dispatch) => {
  const { data } = await fetchProcurementCategories()
  dispatch(procurementCategoriesLoaded(data))
}

export const addProcurementCategory = (name) => async (dispatch) => {
  const { message } = await createProcurementCategory(name)
  await dispatch(loadProcurementCategories())
  return message
}

export const editProcurementCategory = (category, name) => async (dispatch) => {
  const { message } = await renameProcurementCategory(category.id, name)
  await dispatch(loadProcurementCategories())
  return message
}

export const deleteProcurementCategory = (category) => async (dispatch) => {
  const { message } = await destroyProcurementCategory(category.id)
  await dispatch(loadProcurementCategories())
  return message
}
