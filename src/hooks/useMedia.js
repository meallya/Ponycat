import { useCallback, useEffect, useState } from 'react'

const stamp = (m) => (m ? { ...m, receivedAt: performance.now() } : null)

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
    const off = api.onUpdate((m) => setMedia(stamp(m)))
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
