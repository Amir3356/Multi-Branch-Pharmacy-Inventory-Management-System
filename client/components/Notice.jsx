import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

// Shows a notice as a Sonner toast (the <Toaster> in App removes it after 3 seconds). It renders nothing itself.
// notice: { type: 'success' | 'error' | 'info', text } or a plain string. Once shown, onDismiss() clears the page's
// notice state, so setting the same message again shows a new toast.
export default function Notice({ notice, onDismiss }) {
  const shown = useRef(null)

  useEffect(() => {
    // StrictMode runs effects twice in development: the ref stops the same notice being toasted twice
    if (!notice || shown.current === notice) return
    shown.current = notice
    const { type = 'success', text } = typeof notice === 'string' ? { text: notice } : notice
    const show = { success: toast.success, error: toast.error, info: toast.info }[type] ?? toast
    show(text)
    onDismiss?.()
  }, [notice, onDismiss])

  return null
}
