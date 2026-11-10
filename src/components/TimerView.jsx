import { useEffect, useState } from 'react'

const pad = (n) => String(n).padStart(2, '0')

export default function TimerView() {
  const [left, setLeft] = useState(5 * 60) // 5 menit, dihitung mundur

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="timer">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ff9f0a" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9 2h6" />
      </svg>
      <span className="timer-text">
        {pad(Math.floor(left / 60))}:{pad(left % 60)}
      </span>
    </div>
  )
}
