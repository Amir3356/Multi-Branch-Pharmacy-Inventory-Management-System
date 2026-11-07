import { useState } from 'react'
import { Save } from 'lucide-react'
import { Notice } from '../../../components'
import { isWholeNumber } from '../../../utils'
import { MAX_WARNING_DAYS } from '../model/policy'

// Policy for every product at every branch: the Minimum Stock Level and the Expiring Soon window, saved together on
// the server so every user gets them
export default function PolicyForm({ settings, onSave }) {
  const [form, setForm] = useState({ minStock: String(settings.defaultMinStock), expiryDays: String(settings.expiryWarningDays) })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = form.minStock !== String(settings.defaultMinStock) || form.expiryDays !== String(settings.expiryWarningDays)

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setNotice(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!isWholeNumber(form.minStock, 0)) newErrors.minStock = 'Enter a whole number of 0 or more'
    if (!isWholeNumber(form.expiryDays, 1, MAX_WARNING_DAYS)) newErrors.expiryDays = `Enter a whole number from 1 to ${MAX_WARNING_DAYS}`
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return

    const minStock = Number(form.minStock)
    const expiryDays = Number(form.expiryDays)
    setIsSaving(true)
    try {
      await onSave({ minStock, expiryDays })
    } catch (error) {
      setErrors({ minStock: error.fieldErrors?.defaultMinStock, expiryDays: error.fieldErrors?.expiryWarningDays, form: error.fieldErrors ? undefined : error.message })
      setIsSaving(false)
      return
    }
    setIsSaving(false)
    setForm({ minStock: String(minStock), expiryDays: String(expiryDays) })
    setNotice(`Saved. Fewer than ${minStock} units at a branch shows as Low Stock, and a batch expiring within ${expiryDays} days shows as Expiring Soon.`)
  }

  return (
    <>
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <form className="settings-box policy-box" onSubmit={handleSave} noValidate>
        {errors.form && <span className="error-msg">{errors.form}</span>}
        <div className="form-group">
          <label htmlFor="settings-min-stock">Minimum Stock Level (units)</label>
          <input id="settings-min-stock" type="number" min="0" step="1" placeholder="e.g. 20" className={`input-field ${errors.minStock ? 'error' : ''}`} value={form.minStock} onChange={update('minStock')} />
          {errors.minStock
            ? <span className="error-msg">{errors.minStock}</span>
            : <span className="field-hint">A branch with fewer units than this is flagged Low Stock; at 0 it is Out of Stock.</span>}
        </div>

        <div className="form-group">
          <label htmlFor="settings-expiring-soon">Expiring Soon Reminder (days before expiry)</label>
          <input id="settings-expiring-soon" type="number" min="1" max={MAX_WARNING_DAYS} step="1" placeholder="e.g. 60" className={`input-field ${errors.expiryDays ? 'error' : ''}`} value={form.expiryDays} onChange={update('expiryDays')} />
          {errors.expiryDays
            ? <span className="error-msg">{errors.expiryDays}</span>
            : <span className="field-hint">A batch that expires within this many days is flagged Expiring Soon in Inventory and Notifications.</span>}
        </div>

        <div className="policy-actions">
          <button type="submit" className="primary-action-btn" disabled={!isDirty || isSaving}>
            <Save size={16} /> {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </>
  )
}
