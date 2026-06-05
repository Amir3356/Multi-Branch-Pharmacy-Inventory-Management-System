import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import {
  PackageCheck,
  Save,
  X
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { newIdempotencyKey } from '../../../utils'
import { EMPTY_PURCHASE_FORM, toProcurementPayload, unitPriceFrom } from '../model/procurement'
import { validatePurchase } from '../services/purchaseRules'

// Category and Product Name come from what the Purchase Officer adds on the Category & Product page (sidebar). An officer's Receiving Branch is the branch the Owner assigned them in Account Provision, and can't be changed.
export default function NewPurchaseModal({ branches, assignedBranchId, products, categories, suppliers, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_PURCHASE_FORM, branchId: assignedBranchId || '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // One key for this order, kept for every try: if a response is lost and Record purchase is tapped again, the server
  // returns the order it already recorded instead of recording it twice. A new order (a new window) gets a new key.
  const [idempotencyKey] = useState(newIdempotencyKey)
  // Blocks a second submit at once, before the disabled button has re-rendered (a double tap, Enter plus a click)
  const sending = useRef(false)
  const activeBranches = branches.filter((b) => b.status === 'Active')
  const assignedBranch = assignedBranchId ? branches.find((b) => b.id === assignedBranchId) : null

  // While an order is sending the window stays open: closing it and starting again would make a new key, so an order
  // that did reach the server could be recorded twice
  const closeIfIdle = () => {
    if (!sending.current) onClose()
  }
  useEscapeKey(closeIfIdle)

  // Reloading or closing the tab mid-order asks first, for the same reason
  useEffect(() => {
    if (!submitting) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [submitting])

  const categoryProducts = products.filter((p) => p.category === form.category).sort((a, b) => a.name.localeCompare(b.name))
  // Picked from the product catalog (the same list for every user)
  const product = categoryProducts.find((p) => p.id === form.medId)
  const qty = Number(form.qty)
  const totalCost = Number(form.totalCost)
  // The officer enters what the whole order costs; the unit price follows from it
  const unitPrice = unitPriceFrom(totalCost, qty)

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'category') next.medId = ''
      return next
    })
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'category' ? { medId: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (sending.current) return
    const newErrors = validatePurchase(form, { product, qty, totalCost, assignedBranchId, assignedBranch })
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    sending.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      // On success the page closes this modal, so it stays in its submitting state
      await onSave(toProcurementPayload(form, product, qty, totalCost), idempotencyKey)
    } catch (error) {
      sending.current = false
      setSubmitting(false)
      // No answer (status 0): the order may or may not have reached the server, and retrying with the same key is safe
      setSubmitError(error.status === 0 ? `${error.message} Tap Record purchase again: it won’t be recorded twice.` : error.message)
      setErrors(error.fieldErrors || {})
    }
  }

  const field = (name, label, props = {}) => (
    <div className="form-group">
      <label htmlFor={`purchase-${name}`}>{label}</label>
      <input id={`purchase-${name}`} className={`input-field ${errors[name] ? 'error' : ''}`} value={form[name]} onChange={(e) => update(name, e.target.value)} {...props} />
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeIfIdle()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-purchase-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper teal">
              <PackageCheck size={20} />
            </div>
            <div>
              <h2 id="new-purchase-title">Create Procurement</h2>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={closeIfIdle} disabled={submitting} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="purchase-branch">Receiving Branch *</label>
              {assignedBranchId ? (
                <input id="purchase-branch" className={`input-field ${errors.branchId ? 'error' : ''}`} value={assignedBranch?.name || assignedBranchId} readOnly disabled title="Your assigned branch (set by the Owner in Account Provision)" />
              ) : (
                <select id="purchase-branch" autoFocus className={`input-field ${errors.branchId ? 'error' : ''}`} value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>
                  <option value="">Select branch…</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              {errors.branchId && <span className="error-msg">{errors.branchId}</span>}
            </div>
            {field('supplier', 'Supplier *', { placeholder: 'Supplier name', list: 'purchase-suppliers', autoFocus: Boolean(assignedBranchId) })}
            <datalist id="purchase-suppliers">
              {suppliers.map((sup) => <option key={sup} value={sup} />)}
            </datalist>
          </div>

          <div className="modal-section-title">Product</div>
          <div className="form-group">
            <label htmlFor="purchase-category">Category *</label>
            <select id="purchase-category" className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)}>
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category
              ? <span className="error-msg">{errors.category}</span>
              : !categories.length && <span className="field-hint">No categories yet. Add them on the Category & Product page in the sidebar.</span>}
          </div>

          <div className="form-group">
            <label htmlFor="purchase-product">Product Name *</label>
            <select id="purchase-product" className={`input-field ${errors.medId ? 'error' : ''}`} value={form.medId} onChange={(e) => update('medId', e.target.value)} disabled={!form.category}>
              <option value="">{!form.category ? 'Select a category first' : categoryProducts.length ? `Select product… (${categoryProducts.length} in ${form.category})` : 'No products in this category'}</option>
              {categoryProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.medId
              ? <span className="error-msg">{errors.medId}</span>
              : form.category && !categoryProducts.length && <span className="field-hint">Add products to {form.category} on the Category & Product page in the sidebar.</span>}
          </div>

          <div className="modal-grid">
            {field('qty', 'Quantity *', { type: 'number', min: '1', step: '1', placeholder: 'Units bought' })}
            {field('totalCost', 'Total Cost (ETB) *', { type: 'number', min: '0', step: '0.01', placeholder: 'What the whole order costs' })}
          </div>

          <div className="form-group">
            <label htmlFor="purchase-unit-price">Unit Purchase Price</label>
            <input id="purchase-unit-price" className="input-field" value={unitPrice == null ? '—' : formatMoney(unitPrice)} readOnly disabled />
            <span className="field-hint">Calculated: Total Cost ÷ Quantity</span>
          </div>

          {submitError && <span className="error-msg" role="alert">{submitError}</span>}

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={closeIfIdle} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={submitting}>
              <Save size={16} /> {submitting ? 'Saving…' : 'Record purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
