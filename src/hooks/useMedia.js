import { useCallback, useEffect, useState } from 'react'

// `ts` = waktu (epoch ms) saat helper menghitung posisi. Dipakai supaya keterlambatan
// perjalanan data (PowerShell -> main -> renderer) tidak ikut membuat lirik telat.
const stamp = (m) => {
  if (!m) return null
  const lag = m.ts ? Math.min(2000, Math.max(0, Date.now() - m.ts)) : 0
  return { ...m, receivedAt: performance.now() - lag }
}

// Posisi dari Windows kadang goyang beberapa ratus ms antar update. Kalau lagu dan status
// sama dan selisihnya kecil, ikuti jam lokal dengan koreksi pelan (bukan loncat),
// supaya baris lirik tidak maju-mundur. Loncatan besar (seek) langsung diikuti.
const smooth = (prev, next) => {
  if (!prev?.hasSession || !next?.hasSession) return next
  if (prev.status !== 'playing' || next.status !== 'playing') return next
  if (prev.app !== next.app || prev.title !== next.title || prev.artist !== next.artist) return next
  const predicted = prev.position + (next.receivedAt - prev.receivedAt) / 1000
  const err = next.position - predicted
  if (Math.abs(err) >= 0.35) return next
  return { ...next, position: predicted + err * 0.5 }
}

// Status musik dari Windows media session (lewat main process).
// Bentuk data: { hasSession, app, title, artist, album, status, position, duration, thumbnail }
export function useMedia() {
  const [media, setMedia] = useState(null)

  useEffect(() => {
    const api = window.island?.media
    if (!api) return
    let alive = true
    api.get().then((m) => {
      if (alive && m) setMedia(stamp(m))
    })
    const off = api.onUpdate((m) => setMedia((prev) => smooth(prev, stamp(m))))
    return () => {
      alive = false
      off()
    }
  }, [])

  const command = useCallback((cmd) => {
    window.island?.media?.command(cmd)
    // Update langsung di UI supaya tombol terasa responsif, nanti dikoreksi oleh data asli
    if (cmd === 'play-pause') {
      setMedia((m) => {
        if (!m?.hasSession) return m
        const playing = m.status === 'playing'
        const elapsed = playing ? (performance.now() - m.receivedAt) / 1000 : 0
        return {
          ...m,
          status: playing ? 'paused' : 'playing',
          position: m.position + elapsed,
          receivedAt: performance.now(),
        }
      })
    }
  }, [])

  return { media, command }
}
