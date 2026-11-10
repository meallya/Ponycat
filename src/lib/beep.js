let ctx = null

// Bunyi pendek saat timer selesai
export function beep(times = 3) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.resume) ctx.resume()
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 0.28
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.22)
    }
  } catch {
    // audio tidak tersedia, abaikan
  }
}
