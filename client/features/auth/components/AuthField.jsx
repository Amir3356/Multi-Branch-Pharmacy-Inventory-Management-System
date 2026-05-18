import { useState } from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react'

// Labelled input with a left icon and an inline error, styled like the sign-in form
export function AuthField({ id, label, icon: Icon, error, children }) {
  return (
    <div className="input-group">
      <label className="input-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-wrapper">
        <div className="input-icon-left">
          <Icon size={18} />
        </div>
        {children}
      </div>
      {error && (
        <div className="error-msg">
          <AlertCircle size={13} /> {error}
        </div>
      )}
    </div>
  )
}

// Password input with a show/hide toggle
export function PasswordField({ id, label, value, onChange, error, autoComplete = 'new-password', autoFocus }) {
  const [visible, setVisible] = useState(false)
  return (
    <AuthField id={id} label={label} icon={Lock} error={error}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={`input-field ${error ? 'error' : ''}`}
        placeholder="••••••••••••"
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="input-icon-right-btn"
        onClick={() => setVisible(!visible)}
        title={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </AuthField>
  )
}

// Success or error banner above a sign-in form. alert: { type: 'success' | 'error', text }
export function AuthAlert({ alert }) {
  if (!alert) return null
  return (
    <div className={`alert-box ${alert.type}`} role={alert.type === 'error' ? 'alert' : 'status'}>
      {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span>{alert.text}</span>
    </div>
  )
}
