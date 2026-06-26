import { useSyncExternalStore } from 'react'

// Whether a CSS media query matches right now, updating when it changes (e.g. the window is resized)
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
