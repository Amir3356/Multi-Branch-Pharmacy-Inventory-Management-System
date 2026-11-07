import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  X,
  Save,
  Pencil
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { validateInventoryItem } from '../services/inventoryRules'

// Edit one Inventory row: stock and expiry belong to this branch; the selling price belongs to the product at every
// branch. The batch number (set when the procurement's stock arrived) and the purchase price are shown read-only.
export default function EditInventoryModal({ item, branchName, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState({
    stock: String(item.stock),
    expiry: item.expiry,
    sellingPrice: item.sellingPrice == null ? '' : String(item.sellingPrice)
  })
  const purchasePrice = item.purchasePrice || 0
  // Current Stock × Unit Selling Price, following what is typed above
  const stock = Number(form.stock)
  const sellingPrice = Number(form.sellingPrice)
  const totalSellingPrice = Number.isInteger(stock) && stock >= 0 && form.sellingPrice !== '' && sellingPrice > 0 ? stock * sellingPrice : null
  const [errors, setErrors] = useState({})

  useEscapeKey(onClose)

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const sellingPrice = Number(form.sellingPrice)
    const newErrors = validateInventoryItem(form, sellingPrice)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    try {
      await onSave({
        stock: Number(form.stock),
        batch: item.batch,
        expiry: form.expiry,
        purchasePrice,
        sellingPrice: Math.round(sellingPrice * 100) / 100
      })
    } catch (error) {
      // Stock changed since this opened (409) or a stock/expiry problem shows by those fields; anything else by the price
      const fields = error.fieldErrors || {}
      const stockMessage = fields.stock || (error.status === 409 ? error.message : undefined)
      setErrors({ stock: stockMessage, expiry: fields.expiry, sellingPrice: fields.sellingPrice || (stockMessage || fields.expiry ? undefined : error.message) })
    }
  }

  const field = (name, label, props = {}) => (
    <div className="form-group">
      <label htmlFor={`edit-inv-${name}`}>{label}</label>
      <input id={`edit-inv-${name}`} className={`input-field ${errors[name] ? 'error' : ''}`} value={form[name]} onChange={update(name)} {...props} />
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-inv-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <Pencil size={20} />
            </div>
            <div>
              <h2 id="edit-inv-title">Edit Inventory Item</h2>
              <p className="page-desc">{item.name} at {branchName}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="edit-inv-name">Product Name</label>
              <input id="edit-inv-name" className="input-field" value={item.name} readOnly disabled />
            </div>
            <div className="form-group">
              <label htmlFor="edit-inv-branch">Branch</label>
              <input id="edit-inv-branch" className="input-field" value={branchName} readOnly disabled />
            </div>
          </div>

          <div className="modal-section-title">This branch</div>
          {field('stock', 'Current Stock (units) *', { type: 'number', min: '0', step: '1', autoFocus: true })}
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="edit-inv-batch">Batch Number</label>
              <input id="edit-inv-batch" className="input-field" value={item.batch} readOnly disabled />
            </div>
            {field('expiry', 'Expiration Date *', { type: 'date' })}
          </div>

          <div className="modal-section-title">Prices</div>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="edit-inv-purchase-price">Unit Purchase Price</label>
              <input id="edit-inv-purchase-price" className="input-field" value={formatMoney(purchasePrice)} readOnly disabled />
            </div>
            {field('sellingPrice', 'Unit Selling Price *', { type: 'number', min: '0', step: '0.01', placeholder: '0.00' })}
          </div>
          <div className="form-group">
            <label htmlFor="edit-inv-total-selling">Total Selling Price</label>
            <input id="edit-inv-total-selling" className="input-field" value={totalSellingPrice == null ? '—' : formatMoney(totalSellingPrice)} readOnly disabled />
            <span className="field-hint">
              {totalSellingPrice == null ? 'Current Stock × Unit Selling Price' : `${stock} units × ${formatMoney(sellingPrice)}`}
            </span>
          </div>
          <span className="field-hint">Changing the selling price updates {item.name} at every branch.</span>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <Save size={16} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
