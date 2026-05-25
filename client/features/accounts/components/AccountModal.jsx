import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Send, UserCog } from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { ACCOUNT_ROLES, EMPTY_ACCOUNT_FORM, accountToForm, coversAllBranches, toAccountPayload } from '../model/account'
import { validateAccount } from '../services/accountRules'

// Invite a staff member (they get an email to set their password), or edit an existing account
export default function AccountModal({ account, branches, onClose, onSave }) {
  const isEdit = Boolean(account?.id)
  const isPending = account?.status === 'Pending'
  const [form, setForm] = useState(
    isEdit
      ? accountToForm(account)
      : EMPTY_ACCOUNT_FORM
  )
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEscapeKey(onClose)

  const update = (field) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const email = form.email.trim().toLowerCase()
    const newErrors = validateAccount(form, email)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return

    setIsSaving(true)
    try {
      await onSave(toAccountPayload(form, email))
    } catch (error) {
      // Field errors from the API (e.g. email already used) show under their inputs
      setErrors({ ...error.fieldErrors, form: Object.keys(error.fieldErrors || {}).length ? undefined : error.message })
      setIsSaving(false)
    }
  }

  const field = (name, label, props = {}) => (
    <div className="form-group">
      <label htmlFor={`account-${name}`}>{label}</label>
      <input id={`account-${name}`} className={`input-field ${errors[name] ? 'error' : ''}`} value={form[name]} onChange={update(name)} {...props} />
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <UserCog size={20} />
            </div>
            <div>
              <h2 id="account-modal-title">{isEdit ? 'Edit Account' : 'Create Account'}</h2>
              <p className="page-desc">
                {isEdit ? `Update ${account.fullName}'s account.` : "We'll email an invitation link so they can set their own password."}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-section-title">Staff Member</div>
          {field('fullName', 'Full Name *', { placeholder: 'e.g. Meron Alemayehu', autoFocus: true })}
          {field('email', 'Email *', { type: 'email', placeholder: 'name@example.com', autoComplete: 'off' })}
          {isPending && form.email.trim().toLowerCase() !== account.email && (
            <span className="field-hint">Saving sends a new invitation to this address; the old link stops working.</span>
          )}

          <div className="modal-section-title">Access</div>
          <div className="form-group">
            <label htmlFor="account-role">Role *</label>
            <select id="account-role" className={`input-field ${errors.role ? 'error' : ''}`} value={form.role} onChange={update('role')}>
              <option value="">Select role…</option>
              {Object.entries(ACCOUNT_ROLES).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {errors.role
              ? <span className="error-msg">{errors.role}</span>
              : form.role && <span className="field-hint">Can open: {ACCOUNT_ROLES[form.role]?.hint}</span>}
          </div>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="account-branch">Assigned Branch {coversAllBranches(form.role) ? '' : '*'}</label>
              {coversAllBranches(form.role) ? (
                // The Purchase Officer buys for every branch, so there is no branch to assign
                <input id="account-branch" className="input-field" value="All Branches" readOnly disabled />
              ) : (
                <select id="account-branch" className={`input-field ${errors.branchId ? 'error' : ''}`} value={form.branchId} onChange={update('branchId')}>
                  <option value="">Select branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}{b.status === 'Inactive' ? ' (inactive)' : ''}</option>
                  ))}
                </select>
              )}
              {errors.branchId && <span className="error-msg">{errors.branchId}</span>}
            </div>
            {isEdit && (
              <div className="form-group">
                <label htmlFor="account-status">Status</label>
                {isPending ? (
                  <input id="account-status" className="input-field" value="Pending invitation" readOnly disabled />
                ) : (
                  <select id="account-status" className="input-field" value={form.status} onChange={update('status')}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                )}
              </div>
            )}
          </div>

          {errors.form && <span className="error-msg">{errors.form}</span>}

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={isSaving}>
              {isEdit
                ? <><Save size={16} /> {isSaving ? 'Saving…' : 'Save Changes'}</>
                : <><Send size={16} /> {isSaving ? 'Sending invitation…' : 'Create Account & Send Invite'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
