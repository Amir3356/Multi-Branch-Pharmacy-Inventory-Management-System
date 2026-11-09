import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import AuthShell from '../features/auth/components/AuthShell'
import SubmitButton from '../features/auth/components/SubmitButton'
import { AuthAlert, AuthField, PasswordField } from '../features/auth/components/AuthField'
import { signIn } from '../features/auth/store/authThunks'
import { selectAuth } from '../features/auth/store/authSlice'
import { PATHS, canOpen, homePathFor } from '../routes/paths'

export default function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { notice: endedNotice } = useSelector(selectAuth)
  // "Your password was reset" handed over from the reset page, or why the last session ended
  const [alert, setAlert] = useState(() => {
    if (location.state?.notice) return { type: 'success', text: location.state.notice }
    if (endedNotice) return { type: 'error', text: endedNotice }
    return null
  })

  const validateForm = () => {
    const newErrors = {}
    if (!email) newErrors.email = 'Email address is required'
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email address'
    if (!password) newErrors.password = 'Password is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAlert(null)
    if (!validateForm()) return
    setIsSubmitting(true)
    try {
      const user = await dispatch(signIn(email.trim(), password))
      // Back to the page they asked for, if their role can open it; otherwise their home page
      const from = location.state?.from
      const section = Object.keys(PATHS).find((key) => PATHS[key] === from)
      navigate(section && canOpen(user, section) ? from : homePathFor(user), { replace: true })
    } catch (error) {
      setAlert({ type: 'error', text: error.message })
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Welcome Back" subtitle="Sign in to access your pharmacy inventory dashboard">
      <AuthAlert alert={alert} />

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <AuthField id="email" label="Email Address" icon={Mail} error={errors.email}>
          <input
            id="email"
            type="email"
            className={`input-field ${errors.email ? 'error' : ''}`}
            placeholder="name@pharmacy.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors({ ...errors, email: null })
            }}
            autoComplete="email"
          />
        </AuthField>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password) setErrors({ ...errors, password: null })
          }}
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="form-extras" style={{ justifyContent: 'flex-end' }}>
          <Link to={PATHS.forgotPassword} className="forgot-link">
            Forgot password?
          </Link>
        </div>

        <SubmitButton busy={isSubmitting}>
          Sign In
        </SubmitButton>
      </form>
    </AuthShell>
  )
}
