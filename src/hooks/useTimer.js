import { useCallback, useEffect, useRef, useState } from 'react'
import { todayKey } from '../lib/dates.js'

// Teknik Pomodoro: 4 sesi fokus, istirahat pendek di antaranya,
// lalu istirahat panjang setelah sesi fokus ke-4.
export const POMO_PLANS = {
  classic: { label: '25/5', focus: 25, short: 5, long: 15 },
  deep: { label: '50/10', focus: 50, short: 10, long: 20 },
}
export const POMO_ROUND = 4
export const PHASE_LABEL = { focus: 'Fokus', short: 'Istirahat', long: 'Istirahat panjang' }

const STORE_KEY = 'pomo-state'

const phaseSeconds = (plan, phase) => POMO_PLANS[plan][phase] * 60

// Dari fase sekarang ke fase berikutnya. `cycle` = jumlah sesi fokus selesai di putaran ini.
export function nextPhase(phase, cycle) {
  if (phase !== 'focus') return { phase: 'focus', cycle, focusDone: false }
  const c = cycle + 1
  return c >= POMO_ROUND
    ? { phase: 'long', cycle: 0, focusDone: true }
    : { phase: 'short', cycle: c, focusDone: true }
}

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    const plan = POMO_PLANS[s.plan] ? s.plan : 'classic'
    const today = todayKey()
    return { plan, count: s.date === today ? Math.max(0, s.count | 0) : 0 }
  } catch {
    return { plan: 'classic', count: 0 }
  }
}

function saveStore(plan, count) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ plan, count, date: todayKey() }))
  } catch {
    // penyimpanan tidak tersedia, abaikan
  }
}

export function useTimer(onDone) {
  const [duration, setDuration] = useState(5 * 60)
  const [left, setLeft] = useState(5 * 60)
  const [running, setRunning] = useState(false)
  const endAt = useRef(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  // ---- Pomodoro ----
  const [pomoOn, setPomoOn] = useState(false)
  const [phase, setPhase] = useState('focus')
  const [cycle, setCycle] = useState(0)
  const [plan, setPlanState] = useState(() => loadStore().plan)
  const [count, setCount] = useState(() => loadStore().count) // sesi fokus selesai hari ini
  // Cermin state untuk dibaca dari interval tanpa membuat interval dibuat ulang
  const pomo = useRef({ on: false, phase: 'focus', cycle: 0, plan, count, running: false })
  pomo.current = { on: pomoOn, phase, cycle, plan, count, running }
  const lastTimer = useRef(5 * 60) // durasi timer biasa, dipulihkan saat keluar dari Pomodoro

  const begin = useCallback((sec, autoStart) => {
    setDuration(sec)
    setLeft(sec)
    if (autoStart) {
      endAt.current = Date.now() + sec * 1000
      setRunning(true)
    } else {
      setRunning(false)
    }
  }, [])

  // Pindah ke fase berikutnya (otomatis jalan, atau dilewati manual)
  const advance = useCallback(
    (autoStart, countIt) => {
      const p = pomo.current
      const n = nextPhase(p.phase, p.cycle)
      if (n.focusDone && countIt) {
        const c = p.count + 1
        setCount(c)
        saveStore(p.plan, c)
      }
      setPhase(n.phase)
      setCycle(n.cycle)
      begin(phaseSeconds(p.plan, n.phase), autoStart)
    },
    [begin],
  )

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))
      setLeft(remaining)
      if (remaining === 0) {
        setRunning(false)
        doneRef.current?.()
        // Pomodoro: lanjut ke fase berikutnya tanpa menunggu klik
        if (pomo.current.on) advance(true, true)
      }
    }, 100)
    return () => clearInterval(id)
  }, [running, advance])

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

  const preset = useCallback(
    (minutes) => {
      if (running || pomoOn) return
      const sec = Math.max(1, Math.round(Number(minutes) * 60) || 60)
      lastTimer.current = sec
      setDuration(sec)
      setLeft(sec)
    },
    [running, pomoOn],
  )

  const setCustom = useCallback(
    (totalSeconds) => {
      if (running || pomoOn) return
      const sec = Math.max(1, Math.min(99 * 60 + 59, Math.floor(Number(totalSeconds)) || 1))
      lastTimer.current = sec
      setDuration(sec)
      setLeft(sec)
    },
    [running, pomoOn],
  )

  // Masuk / keluar mode Pomodoro (hanya saat timer tidak berjalan)
  const startPomo = useCallback(() => {
    if (running) return
    setPomoOn(true)
    setPhase('focus')
    setCycle(0)
    begin(phaseSeconds(pomo.current.plan, 'focus'), false)
  }, [running, begin])

  const stopPomo = useCallback(() => {
    setPomoOn(false)
    setRunning(false)
    setPhase('focus')
    setCycle(0)
    begin(lastTimer.current, false)
  }, [begin])

  const setPlan = useCallback(
    (key) => {
      if (running || !POMO_PLANS[key]) return
      setPlanState(key)
      pomo.current.plan = key
      saveStore(key, pomo.current.count)
      setPhase('focus')
      setCycle(0)
      begin(phaseSeconds(key, 'focus'), false)
    },
    [running, begin],
  )

  // Pilih fase langsung (mis. ingin istirahat sekarang)
  const pickPhase = useCallback(
    (ph) => {
      if (running || !pomoOn) return
      setPhase(ph)
      begin(phaseSeconds(pomo.current.plan, ph), false)
    },
    [running, pomoOn, begin],
  )

  // Lewati fase sekarang tanpa dihitung sebagai sesi fokus selesai
  const skip = useCallback(() => {
    if (!pomo.current.on) return
    advance(pomo.current.running, false)
  }, [advance])

  return {
    duration,
    left,
    running,
    done: !pomoOn && !running && left === 0,
    toggle,
    reset,
    preset,
    setCustom,
    pomo: {
      on: pomoOn,
      phase,
      plan,
      count,
      // sesi fokus selesai di putaran ini (4 saat istirahat panjang)
      cycle: phase === 'long' ? POMO_ROUND : cycle,
      start: startPomo,
      stop: stopPomo,
      setPlan,
      pickPhase,
      skip,
    },
  }
}
