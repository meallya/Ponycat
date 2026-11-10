import { useCallback, useEffect, useRef, useState } from 'react'

export function useTimer(onDone) {
  const [duration, setDuration] = useState(5 * 60)
  const [left, setLeft] = useState(5 * 60)
  const [running, setRunning] = useState(false)
  const endAt = useRef(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))
      setLeft(remaining)
      if (remaining === 0) {
        setRunning(false)
        doneRef.current?.()
      }
    }, 100)
    return () => clearInterval(id)
  }, [running])

  const toggle = useCallback(() => {
    if (running) {
      setRunning(false)
      return
    }
    const start = left > 0 ? left : duration
    setLeft(start)
    endAt.current = Date.now() + start * 1000
    setRunning(true)
  }, [running, left, duration])

  const reset = useCallback(() => {
    setRunning(false)
    setLeft(duration)
  }, [duration])

  const preset = useCallback((minutes) => {
    if (running) return
    const sec = Math.max(1, Math.round(Number(minutes) * 60) || 60)
    setDuration(sec)
    setLeft(sec)
  }, [running])

  const setCustom = useCallback((totalSeconds) => {
    if (running) return
    const sec = Math.max(1, Math.min(99 * 60 + 59, Math.floor(Number(totalSeconds)) || 1))
    setDuration(sec)
    setLeft(sec)
  }, [running])

  return { duration, left, running, done: !running && left === 0, toggle, reset, preset, setCustom }
}
