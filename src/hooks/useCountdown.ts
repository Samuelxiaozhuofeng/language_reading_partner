import { useCallback, useEffect, useState } from 'react'

export function useCountdown() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (seconds <= 0) {
      return
    }

    const timerId = window.setTimeout(() => {
      setSeconds((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearTimeout(timerId)
  }, [seconds])

  const start = useCallback((nextSeconds: number) => {
    setSeconds(nextSeconds)
  }, [])

  const reset = useCallback(() => {
    setSeconds(0)
  }, [])

  return { reset, seconds, start }
}
