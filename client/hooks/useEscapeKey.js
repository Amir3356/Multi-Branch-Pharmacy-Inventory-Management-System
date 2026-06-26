import { useEffect } from 'react'

// Calls the handler when Escape is pressed (used to close modals)
export function useEscapeKey(handler) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handler])
}
