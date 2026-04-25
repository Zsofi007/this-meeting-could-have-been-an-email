import { useCallback, useEffect, useRef, useState } from 'react'

export function useRateLimiter(options: { cooldownMs: number }) {
  const [coolingDown, setCoolingDown] = useState(false)
  const lastSentAtRef = useRef<number>(0)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const canSend = useCallback(() => {
    const now = Date.now()
    return now - lastSentAtRef.current >= options.cooldownMs
  }, [options.cooldownMs])

  const markSent = useCallback(() => {
    lastSentAtRef.current = Date.now()
    setCoolingDown(true)
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setCoolingDown(false), options.cooldownMs)
  }, [options.cooldownMs])

  return { coolingDown, canSend, markSent }
}

