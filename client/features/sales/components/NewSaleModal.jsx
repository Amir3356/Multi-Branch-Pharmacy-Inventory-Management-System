import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ShoppingCart,
  X
} from 'lucide-react'
import { useEscapeKey, useMoneyColumns } from '../../../hooks'
import { fefoBatches, newIdempotencyKey, productsInStock } from '../../../utils'
import { validateSale } from '../services/saleRules'

const EMPTY_SALE_FORM = { branchId: '', customer: '', category: '', key: '', batch: '', qty: '1' }
// Fields with their own place for an error message
const FORM_FIELDS = ['branchId', 'customer', 'category', 'key', 'batch', 'qty']

export default function NewSaleModal({ branches, inventory, categories, onClose, onSave }) {
  // A cashier's own branch is the only choice, so it starts selected
  const [form, setForm] = useState(() => {
    const active = branches.filter((b) => b.status === 'Active')
    return { ...EMPTY_SALE_FORM, branchId: active.length === 1 ? active[0].id : '' }
  })
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  // One key for this sale, kept for every try: if a response is lost and Complete Sale is tapped again, the server
  // returns the sale it already recorded instead of recording it twice. A new sale (a new window) gets a new key.
  const [idempotencyKey] = useState(newIdempotencyKey)
  // Blocks a second submit at once, before the disabled button has re-rendered (a double tap, Enter plus a click)
  const submitting = useRef(false)
  // The currency is in the label ("Unit Selling Price (ETB)"), so the amounts show the number alone
  const { moneyHeader, formatAmount } = useMoneyColumns()

  // While a sale is sending the window stays open: closing it and starting again would make a new key, so a sale that
  // did reach the server could be recorded twice
  const closeIfIdle = () => {
    if (!submitting.current) onClose()
  }
  useEscapeKey(closeIfIdle)

  // Reloading or closing the tab mid-sale asks first, for the same reason
  useEffect(() => {
    if (!isSaving) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isSaving])

  // Only products the chosen branch has in stock (not expired) can be sold there; each is listed once, however many
  // batches it came in
  const branchStock = productsInStock(inventory.filter((i) => i.branchId === form.branchId && i.sellingPrice != null))
  const categoryCount = (category) => branchStock.filter((i) => i.category === category).length
  // Only categories with in-stock products at this branch
  const inStockCategories = new Set(branchStock.map((i) => i.category))
  const availableCategories = [
    ...(categories || []).filter((c) => inStockCategories.has(c)),
    ...[...inStockCategories].filter((c) => !(categories || []).includes(c))
  ].sort((a, b) => a.localeCompare(b))
  const branchProducts = branchStock
    .filter((i) => i.category === form.category)
    .sort((a, b) => a.name.localeCompare(b.name))
  const product = branchProducts.find((i) => i.key === form.key)
  // FEFO (First Expired, First Out): the sale comes from the batch that expires soonest; the cashier doesn't choose it.
  // Once that batch is sold out, the next sale takes the next one to expire.
  const batchRow = product ? fefoBatches(product.batches)[0] || null : null
  const qty = Number(form.qty)
  const total = product && Number.isInteger(qty) && qty > 0 ? product.sellingPrice * qty : 0
  const fromBatches = batchRow && Number.isInteger(qty) && qty > 0 ? [{ batch: batchRow.batch, qty }] : null

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'branchId') {
        next.category = ''
        next.key = ''
        next.batch = ''
        next.qty = '1'
      }
      if (field === 'category') {
        next.key = ''
        next.batch = ''
        next.qty = '1'
      }
      if (field === 'key') {
        const prod = branchProducts.find((i) => i.key === value)
        // FEFO: the batch that expires first
        next.batch = (prod ? fefoBatches(prod.batches)[0]?.batch : '') || ''
        next.qty = '1'
      }
      return next
    })
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'branchId' ? { category: undefined, key: undefined, batch: undefined, qty: undefined } : {}),
      ...(field === 'category' ? { key: undefined, batch: undefined, qty: undefined } : {}),
      ...(field === 'key' ? { batch: undefined, qty: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateSale(form, product, qty, batchRow)
    setErrors(newErrors)
    if (Object.keys(newErrors).length || submitting.current) return

    submitting.current = true
    setIsSaving(true)
    try {
      // Saved on the server, which works out the total from the unit price
      await onSave({
        branchId: form.branchId,
        customer: form.customer.trim() || 'Walk-in Customer',
        category: product.category,
        product: product.name,
        medId: product.medId,
        batch: batchRow?.batch || form.batch,
        qty,
        unitPrice: product.sellingPrice,
        batches: fromBatches
      }, idempotencyKey)
    } catch (error) {
      // No answer (status 0): the sale may or may not have reached the server, and retrying with the same key is safe
      const message = error.status === 0 ? `${error.message} Tap Complete Sale again: it won’t be recorded twice.` : error.message
      // Errors about a field on this form show under it; others (e.g. an expired batch) show at the top
      const fieldErrors = error.fieldErrors || {}
      const onForm = Object.fromEntries(Object.entries(fieldErrors).filter(([field]) => FORM_FIELDS.includes(field)))
      const other = Object.entries(fieldErrors).find(([field]) => !FORM_FIELDS.includes(field))?.[1]
      setErrors({ ...onForm, form: other || (Object.keys(onForm).length ? undefined : message) })
      submitting.current = false
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeIfIdle()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-sale-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper teal">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h2 id="new-sale-title">New Sale</h2>
              <p className="page-desc">Record a sale to a customer at one of your branches.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={closeIfIdle} disabled={isSaving} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {(errors.form || errors.branchId) && <span className="error-msg">{errors.form || errors.branchId}</span>}
          <div className="form-group">
            <label htmlFor="sale-branch">Branch *</label>
            <select id="sale-branch" autoFocus className={`input-field ${errors.branchId ? 'error' : ''}`} value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>
              <option value="">Select branch…</option>
              {branches.filter((b) => b.status === 'Active').map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {errors.branchId && <span className="error-msg">{errors.branchId}</span>}
          </div>

          <div className="modal-section-title">Customer</div>
          <div className="form-group">
            <label htmlFor="sale-customer">Customer Name</label>
            <input id="sale-customer" className="input-field" placeholder="Walk-in Customer" value={form.customer} onChange={(e) => update('customer', e.target.value)} />
          </div>

          <div className="modal-section-title">Product</div>
          <div className="form-group">
            <label htmlFor="sale-category">Category *</label>
            <select id="sale-category" className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)} disabled={!form.branchId}>
              <option value="">
                {!form.branchId
                  ? 'Select a branch first'
                  : availableCategories.length
                    ? 'Select category…'
                    : 'No products in stock'}
              </option>
              {availableCategories.map((c) => {
                const count = categoryCount(c)
                return (
                  <option key={c} value={c}>
                    {c} ({count} {count === 1 ? 'product' : 'products'})
                  </option>
                )
              })}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="sale-product">Product Name *</label>
            <select id="sale-product" className={`input-field ${errors.key ? 'error' : ''}`} value={form.key} onChange={(e) => update('key', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {branchProducts.map((i) => (
                <option key={i.key} value={i.key}>{i.name}</option>
              ))}
            </select>
            {errors.key && <span className="error-msg">{errors.key}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="sale-batch">Batch ID</label>
            <input
              id="sale-batch"
              className={`input-field ${errors.batch ? 'error' : ''}`}
              value={batchRow ? `${batchRow.batch} · ${batchRow.stock} ${batchRow.stock === 1 ? 'unit' : 'units'} · expires ${batchRow.expiry || 'no date'}` : ''}
              placeholder="Select a product first"
              readOnly
              disabled
            />
            {errors.batch
              ? <span className="error-msg">{errors.batch}</span>
              : batchRow && <span className="field-hint">FEFO (First Expired, First Out): the batch that expires soonest is sold first</span>}
          </div>

          <div className="form-group">
            <label htmlFor="sale-qty">Quantity *</label>
            <input
              id="sale-qty"
              type="number"
              min="1"
              max={batchRow ? batchRow.stock : product?.stock}
              step="1"
              className={`input-field ${errors.qty ? 'error' : ''}`}
              value={form.qty}
              onChange={(e) => update('qty', e.target.value)}
              disabled={!batchRow}
            />
            {errors.qty && <span className="error-msg">{errors.qty}</span>}
            {!errors.qty && batchRow && (
              <span className="field-hint">
                From Batch ID {batchRow.batch} (expires {batchRow.expiry || 'no date'}): {qty} {qty === 1 ? 'unit' : 'units'}
              </span>
            )}
          </div>

          <div className="sale-summary">
            <div><small>In Stock (Batch)</small><strong>{batchRow ? `${batchRow.stock} units` : (product ? `${product.stock} units` : '—')}</strong></div>
            <div><small>{moneyHeader('Unit Selling Price')}</small><strong>{product ? formatAmount(product.sellingPrice) : '—'}</strong></div>
            <div><small>{moneyHeader('Total Selling Price')}</small><strong className="sale-total">{formatAmount(total)}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={closeIfIdle} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={isSaving}>
              <CheckCircle2 size={16} /> {isSaving ? 'Saving…' : 'Complete Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
