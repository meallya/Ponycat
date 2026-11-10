import { useState } from 'react'

const Prev = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M6 5h2v14H6zM20 5v14L9 12z" />
  </svg>
)
const Next = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M16 5h2v14h-2zM4 5l11 7L4 19z" />
  </svg>
)
const Play = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
)
const Pause = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
)

// Data masih dummy. Ganti dengan data asli dari Windows media session kalau mau.
export default function MusicView() {
  const [playing, setPlaying] = useState(true)

  // Tombol di dalam pill tidak boleh ikut memicu klik pill (yang menutupnya)
  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn?.()
  }

  return (
    <div className="music">
      <div className="music-top">
        <div className="art" />
        <div className="meta">
          <div className="title">Midnight Coding</div>
          <div className="artist">Lofi Station</div>
        </div>
        <div className={`eq ${playing ? 'on' : ''}`}>
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>

      <div className="progress">
        <div className={`progress-bar ${playing ? 'run' : ''}`} />
      </div>

      <div className="controls">
        <button onClick={stop()}>
          <Prev />
        </button>
        <button className="play" onClick={stop(() => setPlaying((p) => !p))}>
          {playing ? <Pause /> : <Play />}
        </button>
        <button onClick={stop()}>
          <Next />
        </button>
      </div>
    </div>
  )
}
