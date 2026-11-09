import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import AuthShell from '../features/auth/components/AuthShell'
import SubmitButton from '../features/auth/components/SubmitButton'
import { AuthAlert, AuthField } from '../features/auth/components/AuthField'
import { requestPasswordReset } from '../features/auth/store/authThunks'
import { PATHS } from '../routes/paths'

export default function ForgotPasswordPage() {
  const dispatch = useDispatch()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [alert, setAlert] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAlert(null)
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(email ? 'Please enter a valid email address' : 'Email address is required')
      return
    }
    setIsSubmitting(true)
    try {
      const { message } = await dispatch(requestPasswordReset(email.trim()))
      setAlert({ type: 'success', text: message })
    } catch (err) {
      // Account problems (no account, not set up, deactivated) show under the email field
      if (err.fieldErrors?.email) setError(err.fieldErrors.email)
      else setAlert({ type: 'error', text: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your account email and we'll send you a link to choose a new password.">
      <AuthAlert alert={alert} />

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <AuthField id="email" label="Email Address" icon={Mail} error={error}>
          <input
            id="email"
            type="email"
            className={`input-field ${error ? 'error' : ''}`}
            placeholder="name@pharmacy.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            autoComplete="email"
            autoFocus
          />
        </AuthField>

        <SubmitButton busy={isSubmitting} busyLabel="Sending...">
          Send reset link
        </SubmitButton>

        <Link to={PATHS.login} className="forgot-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </form>
    </AuthShell>
  )
}
