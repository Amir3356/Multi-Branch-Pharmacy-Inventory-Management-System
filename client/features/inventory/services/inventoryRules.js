import { findCatalogProduct, isWholeNumber, todayKey } from '../../../utils'

const isPositivePrice = (raw, value) => raw !== '' && !Number.isNaN(value) && value > 0

// The catalog product a procurement bought: matched by id, or by name for a product the purchase added
export const findProcurementProduct = (products, procurement) =>
  procurement ? findCatalogProduct(products, procurement.medId, procurement.product) : undefined

// Field errors for Receive Stock: which arrived order (category and product), its expiry date, and the selling price
export function validateReceivedStock(form, procurement, product, sellingPrice) {
  const errors = {}
  if (!form.category) errors.category = 'Select a category'
  if (!procurement) errors.purchaseId = form.category ? 'Select a product' : 'Select a category first'
  else if (!product) errors.purchaseId = "This product isn't in the catalog yet. Reload the page and try again."
  // A transfer brings its expiry date with it (fixedExpiry); a paid order's is entered from the package
  if (!procurement?.fixedExpiry) {
    if (!form.expiryDate) errors.expiryDate = 'Enter the expiration date printed on the package'
    else if (form.expiryDate <= todayKey()) errors.expiryDate = 'This stock has already expired; it can’t be added'
  }
  if (!isPositivePrice(form.sellingPrice, sellingPrice)) errors.sellingPrice = 'Enter a selling price greater than 0'
  return errors
}

// Field errors for editing one branch's inventory row
export function validateInventoryItem(form, sellingPrice) {
  const errors = {}
  if (!isWholeNumber(form.stock, 0)) errors.stock = 'Enter a whole number of 0 or more'
  if (!form.expiry) errors.expiry = 'Expiration date is required'
  if (!isPositivePrice(form.sellingPrice, sellingPrice)) errors.sellingPrice = 'Enter a price greater than 0'
  return errors
}
