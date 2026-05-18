import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AuthShell from '../features/auth/components/AuthShell'
import SubmitButton from '../features/auth/components/SubmitButton'
import { AuthAlert, PasswordField } from '../features/auth/components/AuthField'
import { validateNewPassword } from '../features/auth/services/passwordRules'
import { resetPassword } from '../features/auth/store/authThunks'
import { PATHS, homePathFor } from '../routes/paths'

// Opened from the reset email: /reset-password?token=…&email=…
export default function ResetPasswordPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const email = params.get('email') || ''
  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(token && email ? null : { type: 'error', text: 'This reset link is incomplete. Open the link from your email again, or request a new one.' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
    setErrors({ ...errors, [field]: null })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token || !email) return
    const newErrors = validateNewPassword(form.password, form.password_confirmation)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setIsSubmitting(true)
    setAlert(null)
    try {
      const user = await dispatch(resetPassword({ token, email, password: form.password, passwordConfirmation: form.password_confirmation }))
      // Straight to their role's home page (RBAC), no second sign-in
      navigate(homePathFor(user), { replace: true })
    } catch (err) {
      setErrors(err.fieldErrors || {})
      setAlert({ type: 'error', text: err.message })
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle={email ? `For ${email}` : undefined}>
      <AuthAlert alert={alert} />

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <PasswordField id="password" label="New Password" value={form.password} onChange={update('password')} error={errors.password} autoFocus />
        <PasswordField id="password_confirmation" label="Confirm New Password" value={form.password_confirmation} onChange={update('password_confirmation')} error={errors.password_confirmation} />

        <SubmitButton busy={isSubmitting} busyLabel="Signing in...">
          Sign In
        </SubmitButton>

        <Link to={PATHS.forgotPassword} className="forgot-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
          <ArrowLeft size={14} /> Request a new link
        </Link>
      </form>
    </AuthShell>
  )
}
