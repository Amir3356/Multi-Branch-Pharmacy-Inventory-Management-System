import { createProduct, destroyProduct, fetchProducts, updateProduct } from '../../../api/productsApi'
import { productRemoved, productsLoaded } from './productsSlice'

// The product catalog from the server: loaded first, since procurements, transfers and sales refer to its products
export const loadProducts = () => async (dispatch) => {
  const { data } = await fetchProducts()
  dispatch(productsLoaded(data))
}

// Prices changed on another screen (stock added, or a selling price edited): reload the catalog
export const productsPushed = () => (dispatch) => dispatch(loadProducts()).catch(() => {})


// Purchase Officer's Products page: each returns the API's confirmation message; failures throw ApiError

export const addProduct = (data) => async (dispatch) => {
  const { message } = await createProduct(data)
  await dispatch(loadProducts())
  return message
}

export const editProduct = (product, data) => async (dispatch) => {
  const { message } = await updateProduct(product.id, data)
  await dispatch(loadProducts())
  return message
}

export const deleteProduct = (product) => async (dispatch) => {
  const { message } = await destroyProduct(product.id)
  dispatch(productRemoved(product.id))
  await dispatch(loadProducts())
  return message
}
