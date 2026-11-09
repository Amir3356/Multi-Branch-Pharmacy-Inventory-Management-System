import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Tags, X } from 'lucide-react'
import { useEscapeKey } from '../../../hooks'

const NEW = '__new__'

// Add Category & Product (Category & Product page): pick an existing category from the list, or choose "Create new
// category" and type it; then pick a product already filed under it, or choose "Create new product" and type it.
// Leaving the product out adds just a new category. These are what Create Procurement's Category and Product Name lists offer.
// Saving a product generates its Batch ID: a new product gets its first one, and picking a product already in the
// category gives it another one (the same product and category, a new batch the Purchase Officer can buy under).
// `categories` are the existing names, `products` the catalog ({ id, name, category, batches }); onAddCategory(name),
// onAddProduct({ name, category }) and onAddBatch(product) return the API's message.
export default function CatalogEntryModal({ categories, products, onClose, onAddCategory, onAddProduct, onAddBatch, onDone }) {
  // category / product: a picked name, NEW, or ''; newCategory / newProduct: what's typed for NEW
  const [form, setForm] = useState({ category: '', newCategory: '', product: '', newProduct: '' })
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEscapeKey(onClose)

  const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b))
  const creatingCategory = form.category === NEW
  const creatingProduct = form.product === NEW
  // A typed name that matches an existing one uses it instead of creating a duplicate
  const typedCategory = form.newCategory.trim()
  const categoryName = creatingCategory
    ? sortedCategories.find((c) => c.toLowerCase() === typedCategory.toLowerCase()) ?? typedCategory
    : form.category
  const categoryExists = Boolean(categoryName) && sortedCategories.some((c) => c.toLowerCase() === categoryName.toLowerCase())
  const categoryProducts = categoryExists
    ? products.filter((p) => p.category.toLowerCase() === categoryName.toLowerCase()).map((p) => p.name).sort((a, b) => a.localeCompare(b))
    : []
  const typedProduct = form.newProduct.trim()
  const productName = creatingProduct ? categoryProducts.find((n) => n.toLowerCase() === typedProduct.toLowerCase()) ?? typedProduct : form.product
  const productExists = Boolean(productName) && categoryProducts.some((n) => n.toLowerCase() === productName.toLowerCase())
  // The catalog product a new batch is for, when the picked (or typed) product is already in the category
  const existingProduct = productExists
    ? products.find((p) => p.category.toLowerCase() === categoryName.toLowerCase() && p.name.toLowerCase() === productName.toLowerCase())
    : null
  const batchCount = existingProduct?.batches?.length ?? 0

  const update = (field) => (e) => {
    const value = e.target.value
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Another category means another product list; a new category has no products yet, so it starts on a new one
      ...(field === 'category' ? { product: value === NEW ? NEW : '', newProduct: '' } : {})
    }))
    setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === 'newCategory' ? { category: undefined } : {}), ...(field === 'newProduct' ? { product: undefined } : {}), form: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.category) return setErrors({ category: 'Select a category, or create a new one.' })
    if (creatingCategory && !typedCategory) return setErrors({ newCategory: 'Enter the new category name.' })
    if (creatingProduct && !typedProduct) return setErrors({ newProduct: 'Enter the new product name.' })
    if (categoryExists && !productName) return setErrors({ product: `${categoryName} already exists. Pick "Create new product" to add one to it.` })

    setIsSaving(true)
    const messages = []
    let step = 'category'
    try {
      // A new category first, so the product can be filed under it
      if (!categoryExists) messages.push(await onAddCategory(categoryName))
      step = 'product'
      // An existing product gets a new Batch ID; a new one is added with its first
      if (existingProduct) messages.push(await onAddBatch(existingProduct))
      else if (productName) messages.push(await onAddProduct({ name: productName, category: categoryName }))
      onDone(messages.join(' '))
    } catch (error) {
      const fieldErrors = error.fieldErrors || {}
      // The category API names its field `name`; the product API uses `name` for the product and `category`
      const fieldError = step === 'category'
        ? { [creatingCategory ? 'newCategory' : 'category']: fieldErrors.name }
        : { [creatingProduct ? 'newProduct' : 'product']: fieldErrors.name, category: fieldErrors.category }
      const shown = Object.values(fieldError).some(Boolean)
      // A new category saved before the product failed stays saved: it now matches an existing one, so a retry adds the product
      setErrors({ ...fieldError, form: shown ? undefined : error.message })
      setIsSaving(false)
    }
  }

  const fieldClass = (name) => `input-field ${errors[name] ? 'error' : ''}`

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 480 }} role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <Tags size={20} />
            </div>
            <div>
              <h2 id="catalog-modal-title">Add Category & Product</h2>
              <p className="page-desc">They will appear in the Category and Product Name lists when you create a procurement.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="catalog-category">Category *</label>
            <select id="catalog-category" className={fieldClass('category')} value={form.category} onChange={update('category')} autoFocus>
              <option value="">{sortedCategories.length ? 'Select category…' : 'No categories yet'}</option>
              {sortedCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={NEW}>+ Create new category…</option>
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          {creatingCategory && (
            <div className="form-group">
              <label htmlFor="catalog-new-category">New Category Name *</label>
              <input
                id="catalog-new-category"
                className={fieldClass('newCategory')}
                value={form.newCategory}
                onChange={update('newCategory')}
                placeholder="e.g. Dairy & Eggs"
                maxLength={120}
                autoComplete="off"
                autoFocus
              />
              {errors.newCategory
                ? <span className="error-msg">{errors.newCategory}</span>
                : typedCategory && <span className="field-hint">{categoryExists ? `${categoryName} already exists: the product will be added to it.` : 'It will be created.'}</span>}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="catalog-product">Product Name{categoryExists ? ' *' : ''}</label>
            <select id="catalog-product" className={fieldClass('product')} value={form.product} onChange={update('product')} disabled={!form.category}>
              <option value="">
                {!form.category ? 'Select a category first' : categoryExists ? `Select product… (${categoryProducts.length} in ${categoryName})` : 'No product: add just the category'}
              </option>
              {categoryProducts.map((n) => <option key={n} value={n}>{n}</option>)}
              <option value={NEW}>+ Create new product…</option>
            </select>
            {errors.product
              ? <span className="error-msg">{errors.product}</span>
              : productExists && <span className="field-hint">{productName} is already in {categoryName}: saving adds a new Batch ID for it.</span>}
          </div>

          {creatingProduct && (
            <div className="form-group">
              <label htmlFor="catalog-new-product">New Product Name *</label>
              <input
                id="catalog-new-product"
                className={fieldClass('newProduct')}
                value={form.newProduct}
                onChange={update('newProduct')}
                placeholder="e.g. Fresh Milk 1L"
                maxLength={255}
                autoComplete="off"
                autoFocus={!creatingCategory}
              />
              {errors.newProduct
                ? <span className="error-msg">{errors.newProduct}</span>
                : typedProduct && <span className="field-hint">{productExists ? `${productName} is already in ${categoryName}: saving adds a new Batch ID for it.` : `It will be added to ${categoryName || 'the new category'}.`}</span>}
            </div>
          )}

          {productName && (
            <div className="form-group">
              <label htmlFor="catalog-batch">Batch ID</label>
              <input id="catalog-batch" className="input-field" value="Generated automatically when you save" readOnly disabled />
              <span className="field-hint">
                {existingProduct
                  ? `${productName} gets a new Batch ID (it has ${batchCount} so far). Procurements can then buy it under either batch.`
                  : 'Procurements buy under this Batch ID, and the Inventory Officer receives the stock under the same one.'}
              </span>
            </div>
          )}

          {errors.form && <span className="error-msg">{errors.form}</span>}

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={isSaving}>
              <Plus size={16} /> {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
