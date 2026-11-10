// Nada pendek (dua not lembut) untuk mode "Nada" dan pengingat 10 menit sebelum.
// Dibuat dengan Web Audio, jadi tidak perlu file suara tambahan.
let ctx = null;

export function playTone() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    [
      [659.25, 0], // E5
      [880, 0.28], // A5
    ].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.95);
    });
  } catch {
    /* abaikan */
  }
}
