import { api } from '../utils/http'

// The product catalog, shared by every branch
export const PRODUCTS_ENDPOINTS = {
  list: '/products',
  one: (id) => `/products/${encodeURIComponent(id)}`,
  batches: (id) => `/products/${encodeURIComponent(id)}/batches`,
  sellingPrice: (id) => `/products/${encodeURIComponent(id)}/selling-price`
}

// Returns the API's JSON; failures throw ApiError
export const fetchProducts = () => api(PRODUCTS_ENDPOINTS.list)

// Inventory Officer: a product's unit selling price, at every branch
export const updateSellingPrice = (id, sellingPrice) => api(PRODUCTS_ENDPOINTS.sellingPrice(id), { method: 'PUT', body: { sellingPrice } })

// Purchase Officer (Products page): add a product to the catalog, or change or delete one that has no stock yet
export const createProduct = ({ name, category }) => api(PRODUCTS_ENDPOINTS.list, { method: 'POST', body: { name, category } })
// Purchase Officer (Category & Product page): a new Batch ID for a product already in the catalog
export const createProductBatch = (id) => api(PRODUCTS_ENDPOINTS.batches(id), { method: 'POST' })
export const updateProduct = (id, { name, category }) => api(PRODUCTS_ENDPOINTS.one(id), { method: 'PATCH', body: { name, category } })
export const destroyProduct = (id) => api(PRODUCTS_ENDPOINTS.one(id), { method: 'DELETE' })
