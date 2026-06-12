import { createPortal } from 'react-dom'
import { useState } from 'react'
import { Save, Wallet, X } from 'lucide-react'
import { useEscapeKey, useMoneyColumns } from '../../../hooks'
import { todayKey } from '../../../utils'
import { EXPENSE_CATEGORIES, emptyExpenseForm } from '../model/expense'
import { validateExpense } from '../services/expenseRules'

// Record one of the branch's expenses: what it was for and how much. It is dated the day it is added.
export default function ExpenseModal({ branchName, onClose, onSave }) {
  const today = todayKey()
  const [form, setForm] = useState(() => emptyExpenseForm(today))
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const { moneyHeader } = useMoneyColumns()

  useEscapeKey(onClose)

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined, ...(field === 'category' ? { description: undefined } : {}) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateExpense(form, today)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setIsSaving(true)
    try {
      // No date field: the expense is recorded on the day it is added (taken when Save is tapped)
      await onSave({ ...form, date: todayKey() })
    } catch (error) {
      // A date error has no field on this form any more, so it shows at the top
      const { date: dateError, ...fieldErrors } = error.fieldErrors || {}
      setErrors({ ...fieldErrors, form: dateError || (Object.keys(fieldErrors).length ? undefined : error.message) })
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="expense-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper warning">
              <Wallet size={20} />
            </div>
            <div>
              <h2 id="expense-title">Add Expense · {branchName}</h2>
              <p className="page-desc">A cost this branch paid: rent, transportation, utilities and so on.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {errors.form && <span className="error-msg">{errors.form}</span>}

          <div className="form-group">
            <label htmlFor="expense-category">Expense Category *</label>
            <select id="expense-category" autoFocus className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={update('category')}>
              <option value="">Select category…</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="expense-amount">{moneyHeader('Amount')} *</label>
            <input id="expense-amount" type="number" min="0" step="0.01" placeholder="0.00" className={`input-field ${errors.amount ? 'error' : ''}`} value={form.amount} onChange={update('amount')} />
            {errors.amount && <span className="error-msg">{errors.amount}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="expense-description">Description {form.category === 'Other' ? '*' : '(optional)'}</label>
            <input id="expense-description" maxLength={255} placeholder="e.g. October rent, delivery from the supplier" className={`input-field ${errors.description ? 'error' : ''}`} value={form.description} onChange={update('description')} />
            {errors.description && <span className="error-msg">{errors.description}</span>}
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={isSaving}>
              <Save size={16} /> {isSaving ? 'Saving…' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
