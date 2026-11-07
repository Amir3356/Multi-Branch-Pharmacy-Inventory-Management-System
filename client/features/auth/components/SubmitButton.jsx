import { ArrowRight } from 'lucide-react'

// Full-width form button, disabled while the request is running; busyLabel replaces the text meanwhile
export default function SubmitButton({ busy, busyLabel, children }) {
  return (
    <button type="submit" className="submit-btn" disabled={busy} aria-busy={busy}>
      <span>{busy && busyLabel ? busyLabel : children}</span>
      {!busy && <ArrowRight size={18} />}
    </button>
  )
}
