import { useEffect, useState } from 'react'

// The current time, refreshed on an interval (for "x min ago" labels and idle checks)
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
