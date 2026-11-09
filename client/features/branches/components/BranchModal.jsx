import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  Building2,
  X,
  Save
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { EMPTY_BRANCH_FORM, branchToForm, toBranchPayload } from '../model/branch'
import { validateBranch } from '../services/branchRules'

export default function BranchModal({ branch, branches, onClose, onSave }) {
  const isEdit = Boolean(branch?.id)
  const [form, setForm] = useState(isEdit ? branchToForm(branch) : EMPTY_BRANCH_FORM)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEscapeKey(onClose)

  const updateField = (field) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = () => {
    const newErrors = validateBranch(form, branches, branch)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    try {
      await onSave(toBranchPayload(form))
    } catch (error) {
      // Field errors from the API (e.g. name already taken) show under their inputs
      setErrors({ ...error.fieldErrors, form: Object.keys(error.fieldErrors || {}).length ? undefined : error.message })
      setIsSaving(false)
    }
  }

  const field = (name, label, placeholder, props = {}) => (
    <div className="form-group">
      <label htmlFor={`branch-${name}`}>{label}</label>
      <input
        id={`branch-${name}`}
        className={`input-field ${errors[name] ? 'error' : ''}`}
        placeholder={placeholder}
        value={form[name]}
        onChange={updateField(name)}
        {...props}
      />
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-branch-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <Building2 size={20} />
            </div>
            <div>
              <h2 id="add-branch-title">{isEdit ? 'Edit Branch' : 'Create New Branch'}</h2>
              <p className="page-desc">{isEdit ? `Update the details of ${branch.name}.` : 'Register a new pharmacy branch in the network.'}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-section-title">Branch Details</div>
          {field('name', 'Branch Name *', 'e.g. Northside Branch', { autoFocus: true })}
          {field('location', 'Location / Address *', 'Street, area, city')}
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="branch-status">Status</label>
              <select id="branch-status" className="input-field" value={form.status} onChange={updateField('status')}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {errors.form && <span className="error-msg">{errors.form}</span>}

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={isSaving}>
              {isEdit ? <><Save size={16} /> {isSaving ? 'Saving…' : 'Save Changes'}</> : <><Plus size={16} /> {isSaving ? 'Creating…' : 'Create Branch'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
