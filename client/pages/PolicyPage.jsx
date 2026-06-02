import { useDispatch, useSelector } from 'react-redux'
import { selectSettings } from '../features/policy/store/settingsSlice'
import { savePolicy } from '../features/policy/store/policyThunks'
import PolicyForm from '../features/policy/components/PolicyForm'
import './PolicyPage.css'

export default function PolicyPage() {
  const dispatch = useDispatch()
  const settings = useSelector(selectSettings)

  return (
    <div className="content-section-card settings-panel">
      <div className="section-header">
        <div>
          <h2 className="page-title">Policy</h2>
          <p className="page-desc">
            Applies to every product at all branches, for everyone.
            {settings.policyUpdatedBy && ` Last changed by ${settings.policyUpdatedBy} on ${new Date(settings.policyUpdatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`}
          </p>
        </div>
      </div>

      {/* Saved on the server; the form shows any error */}
      <PolicyForm settings={settings} onSave={(values) => dispatch(savePolicy(values))} />
    </div>
  )
}
