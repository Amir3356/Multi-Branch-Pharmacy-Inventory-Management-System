import { createPortal } from 'react-dom'
import { useState } from 'react'
import { PackageX, X } from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { validateDamage } from '../services/damageRules'
import { DAMAGE_REASONS } from '../model/damageRecord'

const EMPTY_DAMAGE_FORM = { category: '', productName: '', batchKey: '', qty: '', reason: '' }

// Records stock that was physically damaged and takes it out of the branch's sellable stock
export default function RecordDamageModal({ inventory, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_DAMAGE_FORM)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEscapeKey(onClose)

  // Filter inventory with stock > 0
  const availableStock = inventory.filter((i) => i.stock > 0)
  // Categories and products as the Inventory page lists them (its Category and Product Name columns): only what's in stock
  const categories = [...new Set(availableStock.map((i) => i.category))].sort((a, b) => a.localeCompare(b))
  const categoryCount = (cat) => availableStock.filter((i) => i.category === cat).length

  // Products under chosen category
  const categoryItems = availableStock.filter((i) => i.category === form.category)
  const productNames = [...new Set(categoryItems.map((i) => i.name))].sort((a, b) => a.localeCompare(b))

  // Batches available for chosen product
  const availableBatches = categoryItems.filter((i) => i.name === form.productName)
  const product = availableBatches.find((i) => i.key === form.batchKey)

  const qty = Number(form.qty)
  const validQty = product && Number.isInteger(qty) && qty > 0 && qty <= product.stock ? qty : 0
  const lossValue = product ? validQty * product.purchasePrice : 0

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'category' ? { productName: '', batchKey: '', qty: '' } : {}),
      ...(field === 'productName' ? { batchKey: '', qty: '' } : {}),
      ...(field === 'batchKey' ? { qty: '' } : {})
    }))
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'category' ? { productName: undefined, batchKey: undefined, qty: undefined } : {}),
      ...(field === 'productName' ? { batchKey: undefined, qty: undefined } : {}),
      ...(field === 'batchKey' ? { qty: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateDamage(form, product, qty)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return

    // The server works out the loss value itself, from the product's purchase price
    setIsSaving(true)
    try {
      await onSave({ medId: product.medId, product: product.name, category: product.category, batch: product.batch, qty, reason: form.reason })
    } catch (error) {
      setErrors({ ...error.fieldErrors, form: Object.keys(error.fieldErrors || {}).length ? undefined : error.message })
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="record-damage-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper danger">
              <PackageX size={20} />
            </div>
            <div>
              <h2 id="record-damage-title">Record Damaged Item</h2>
              <p className="page-desc">Remove physically damaged stock so it is no longer counted as sellable.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-section-title">Product & Batch</div>
          
          <div className="form-group">
            <label htmlFor="damage-category">Category *</label>
            <select
              id="damage-category"
              autoFocus
              className={`input-field ${errors.category ? 'error' : ''}`}
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
            >
              <option value="">Select category…</option>
              {categories.map((c) => {
                const count = categoryCount(c)
                return (
                  <option key={c} value={c}>
                    {c} ({count} in stock)
                  </option>
                )
              })}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="damage-product">Product Name *</label>
            <select
              id="damage-product"
              className={`input-field ${errors.productName ? 'error' : ''}`}
              value={form.productName}
              onChange={(e) => update('productName', e.target.value)}
              disabled={!form.category}
            >
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {productNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {errors.productName && <span className="error-msg">{errors.productName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="damage-batch">Batch Number *</label>
            <select
              id="damage-batch"
              className={`input-field ${errors.batchKey ? 'error' : ''}`}
              value={form.batchKey}
              onChange={(e) => update('batchKey', e.target.value)}
              disabled={!form.productName}
            >
              <option value="">{form.productName ? 'Select batch number…' : 'Select a product name first'}</option>
              {availableBatches.map((b) => (
                <option key={b.key} value={b.key}>
                  Batch {b.batch} · {b.stock} {b.stock === 1 ? 'unit' : 'units'} in stock
                </option>
              ))}
            </select>
            {errors.batchKey && <span className="error-msg">{errors.batchKey}</span>}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="damage-qty">Damaged Quantity *</label>
              <input
                id="damage-qty"
                type="number"
                min="1"
                max={product?.stock}
                step="1"
                placeholder="Units damaged"
                className={`input-field ${errors.qty ? 'error' : ''}`}
                value={form.qty}
                onChange={(e) => update('qty', e.target.value)}
                disabled={!product}
              />
              {errors.qty && <span className="error-msg">{errors.qty}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="damage-reason">Reason *</label>
              <select
                id="damage-reason"
                className={`input-field ${errors.reason ? 'error' : ''}`}
                value={form.reason}
                onChange={(e) => update('reason', e.target.value)}
              >
                <option value="">Select reason…</option>
                {DAMAGE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.reason && <span className="error-msg">{errors.reason}</span>}
            </div>
          </div>

          <div className="sale-summary">
            <div><small>In Stock</small><strong>{product ? `${product.stock} units` : '—'}</strong></div>
            <div><small>Stock After</small><strong>{product ? `${product.stock - validQty} units` : '—'}</strong></div>
            <div><small>Loss Value</small><strong className="negative-text">{formatMoney(lossValue)}</strong></div>
          </div>

          {errors.form && <span className="error-msg" role="alert">{errors.form}</span>}

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="danger-action-btn" disabled={isSaving}>
              <PackageX size={16} /> {isSaving ? 'Recording…' : 'Record Damage'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
