import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  ArrowLeftRight,
  X
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { fifoBatches, productsInStock } from '../../../utils'
import { validateTransfer } from '../services/transferRules'

const EMPTY_TRANSFER_FORM = { from: '', to: '', category: '', key: '', batch: '', qty: '' }

// assignedBranchId: staff always send from their own branch (shown read-only); the Owner (null) picks any branch
export default function NewTransferModal({ branches, assignedBranchId, inventory, maxQty, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_TRANSFER_FORM, from: assignedBranchId || '' })
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const activeBranches = branches.filter((b) => b.status === 'Active')

  useEscapeKey(onClose)

  // Products come from the sending branch's stock, each listed once however many batches it came in
  const sourceStock = productsInStock(inventory.filter((i) => i.branchId === form.from))
  // Categories as the Inventory page lists them for the sending branch: only those with products in stock there
  const categories = [...new Set(sourceStock.map((i) => i.category))].sort((a, b) => a.localeCompare(b))
  const categoryCount = (category) => sourceStock.filter((i) => i.category === category).length
  const sourceProducts = sourceStock.filter((i) => i.category === form.category).sort((a, b) => a.name.localeCompare(b.name))
  const product = sourceProducts.find((i) => i.key === form.key)
  // Its batches with units left and not expired, oldest first (the one to move first)
  const batches = product ? fifoBatches(product.batches) : []
  const batchRow = batches.find((b) => b.batch === form.batch)
  const destinationStock = product ? (inventory.find((i) => i.branchId === form.to && i.medId === product.medId)?.productStock || 0) : 0
  const qty = Number(form.qty)
  const validQty = batchRow && Number.isInteger(qty) && qty > 0 && qty <= batchRow.stock ? qty : 0

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Changing the sending branch or category resets the product picked from its stock
      ...(field === 'from' ? { category: '', key: '', qty: '' } : {}),
      ...(field === 'category' ? { key: '', qty: '' } : {}),
      // A product starts on its oldest batch (first in, first out)
      ...(field === 'key' ? { batch: fifoBatches(sourceStock.find((i) => i.key === value)?.batches || [])[0]?.batch || '', qty: '' } : {}),
      ...(field === 'batch' ? { qty: '' } : {})
    }))
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'from' ? { to: undefined, category: undefined, key: undefined, qty: undefined } : {}),
      ...(field === 'category' ? { key: undefined, qty: undefined } : {}),
      ...(field === 'key' ? { batch: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateTransfer(form, product, batchRow, qty, maxQty, branches.find((b) => b.id === form.to))
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setIsSaving(true)
    try {
      // Saved on the server: the receiving branch sees it under Incoming and adds it with Receive Stock
      await onSave({
        from: form.from,
        to: form.to,
        category: product.category,
        product: product.name,
        medId: product.medId,
        batch: form.batch,
        expiry: batchRow.expiry,
        qty
      })
    } catch (error) {
      setErrors({ ...error.fieldErrors, form: Object.keys(error.fieldErrors || {}).length ? undefined : error.message })
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-transfer-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper warning">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 id="new-transfer-title">New Stock Transfer</h2>
              <p className="page-desc">Send stock to another branch. It leaves your stock now and reaches theirs when their Inventory Officer adds it.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {errors.form && <span className="error-msg">{errors.form}</span>}
          <div className="modal-section-title">Branches</div>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="transfer-from">From Branch {assignedBranchId ? '' : '*'}</label>
              {assignedBranchId ? (
                <input id="transfer-from" className="input-field" value={branches.find((b) => b.id === assignedBranchId)?.name || assignedBranchId} readOnly disabled title="Your assigned branch (set by the Owner in Account Provision)" />
              ) : (
                <select id="transfer-from" autoFocus className={`input-field ${errors.from ? 'error' : ''}`} value={form.from} onChange={(e) => update('from', e.target.value)}>
                  <option value="">Select branch…</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              {errors.from && <span className="error-msg">{errors.from}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="transfer-to">To Branch *</label>
              <select id="transfer-to" autoFocus={Boolean(assignedBranchId)} className={`input-field ${errors.to ? 'error' : ''}`} value={form.to} onChange={(e) => update('to', e.target.value)}>
                <option value="">Select branch…</option>
                {/* Every branch is listed, deactivated ones marked: picking one is stopped on Send Transfer */}
                {branches.map((b) => (
                  <option key={b.id} value={b.id} disabled={b.id === form.from}>{b.name}{b.status === 'Active' ? '' : ' (deactivated)'}</option>
                ))}
              </select>
              {errors.to && <span className="error-msg">{errors.to}</span>}
            </div>
          </div>

          <div className="modal-section-title">Product</div>
          <div className="form-group">
            <label htmlFor="transfer-category">Category *</label>
            <select id="transfer-category" className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)} disabled={!form.from}>
              <option value="">{form.from ? 'Select category…' : 'Select the sending branch first'}</option>
              {categories.map((c) => {
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
            <label htmlFor="transfer-product">Product Name *</label>
            <select id="transfer-product" className={`input-field ${errors.key ? 'error' : ''}`} value={form.key} onChange={(e) => update('key', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {sourceProducts.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.name} · {i.stock} available
                </option>
              ))}
            </select>
            {errors.key && <span className="error-msg">{errors.key}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="transfer-batch">Batch Number *</label>
            <select id="transfer-batch" className={`input-field ${errors.batch ? 'error' : ''}`} value={form.batch} onChange={(e) => update('batch', e.target.value)} disabled={!product}>
              <option value="">{product ? 'Select batch…' : 'Select a product first'}</option>
              {batches.map((b, index) => (
                <option key={b.batch} value={b.batch}>
                  {b.batch} · {b.stock} {b.stock === 1 ? 'unit' : 'units'} · expires {b.expiry}{index === 0 ? ' · oldest' : ''}
                </option>
              ))}
            </select>
            {errors.batch && <span className="error-msg">{errors.batch}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="transfer-qty">Quantity *</label>
            <input id="transfer-qty" type="number" min="1" max={batchRow ? Math.min(batchRow.stock, maxQty) : undefined} step="1" placeholder="Units to move" className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} disabled={!product} />
            {errors.qty && <span className="error-msg">{errors.qty}</span>}
          </div>

          <div className="sale-summary">
            <div><small>Available in Batch</small><strong>{batchRow ? `${batchRow.stock} units` : '—'}</strong></div>
            <div><small>Source After</small><strong>{product ? `${product.productStock - validQty} units` : '—'}</strong></div>
            <div><small>Destination After</small><strong>{product && form.to ? `${destinationStock + validQty} units` : '—'}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={isSaving}>
              <ArrowLeftRight size={16} /> {isSaving ? 'Sending…' : 'Send Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
