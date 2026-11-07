import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AuthShell from '../features/auth/components/AuthShell'
import SubmitButton from '../features/auth/components/SubmitButton'
import { AuthAlert, PasswordField } from '../features/auth/components/AuthField'
import { validateNewPassword } from '../features/auth/services/passwordRules'
import { acceptInvitation, fetchInvitation } from '../features/auth/store/authThunks'
import { PATHS, homePathFor } from '../routes/paths'

// Opened from the invitation email: /accept-invitation?token=…
// The invited person sets a password and lands on their role's dashboard.
export default function AcceptInvitationPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [invitation, setInvitation] = useState(null)
  const [loadError, setLoadError] = useState(token ? null : 'This invitation link is incomplete. Open the link from your email again.')
  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    let ignore = false
    dispatch(fetchInvitation(token))
      .then((details) => !ignore && setInvitation(details))
      .catch((err) => !ignore && setLoadError(err.message))
    return () => {
      ignore = true
    }
  }, [dispatch, token])

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
    setErrors({ ...errors, [field]: null })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateNewPassword(form.password, form.password_confirmation)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setIsSubmitting(true)
    setAlert(null)
    try {
      const user = await dispatch(acceptInvitation(token, form.password, form.password_confirmation))
      // Straight to their role's home page (RBAC), no second sign-in
      navigate(homePathFor(user), { replace: true })
    } catch (err) {
      setErrors(err.fieldErrors || {})
      setAlert({ type: 'error', text: err.message })
      setIsSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <AuthShell title="Invitation unavailable">
        <AuthAlert alert={{ type: 'error', text: loadError }} />
        <Link to={PATHS.login} className="forgot-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <ArrowLeft size={14} /> Go to sign in
        </Link>
      </AuthShell>
    )
  }

  if (!invitation) {
    return (
      <AuthShell title="Checking your invitation…" />
    )
  }

  const where = invitation.branchName ? ` at ${invitation.branchName}` : ''
  return (
    <AuthShell
      title={`Welcome, ${invitation.fullName}`}
      subtitle={`You've been invited as ${invitation.roleLabel}${where}. Choose a password for ${invitation.email} to finish setting up your account.`}
    >
      <AuthAlert alert={alert} />

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <PasswordField id="password" label="Password" value={form.password} onChange={update('password')} error={errors.password} autoFocus />
        <PasswordField id="password_confirmation" label="Confirm Password" value={form.password_confirmation} onChange={update('password_confirmation')} error={errors.password_confirmation} />

        <SubmitButton busy={isSubmitting} busyLabel="Setting up...">
          Set password and continue
        </SubmitButton>
      </form>
    </AuthShell>
  )
}
