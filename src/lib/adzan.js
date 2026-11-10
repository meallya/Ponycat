// Pemutar adzan: saat adzan mulai, musik yang sedang jalan di-pause;
// saat adzan selesai (atau dihentikan), musik dilanjutkan otomatis.
//
//   getMedia() -> objek `media` terbaru ({ hasSession, status: 'playing' | 'paused', ... })
//   command(c) -> kirim perintah ke pemutar musik ('play-pause', dst.)
//   onChange(n) -> dipanggil dengan nama sholat saat mulai, dan null saat selesai

export function createAdzanPlayer({ getMedia, command, onChange }) {
  let audio = null;
  let current = null;
  let pausedByUs = false;
  let pausedAt = 0;

  const finish = () => {
    if (!current) return;
    const a = audio;
    audio = null;
    current = null;
    if (a) {
      a.onended = null;
      a.onerror = null;
      try {
        a.pause();
      } catch {
        /* abaikan */
      }
    }
    if (pausedByUs) {
      pausedByUs = false;
      const m = getMedia?.();
      // Lanjutkan hanya kalau musik memang masih berhenti. Status dari Windows
      // bisa telat beberapa detik, jadi kalau baru saja kita pause anggap masih berhenti.
      const stillPaused =
        m?.status !== "playing" || Date.now() - pausedAt < 3000;
      if (stillPaused) command?.("play-pause");
    }
    onChange?.(null);
  };

  const start = (name, src) => {
    if (current || !src) return false;
    current = name;
    const m = getMedia?.();
    if (m?.hasSession && m.status === "playing") {
      command?.("play-pause");
      pausedByUs = true;
      pausedAt = Date.now();
    }
    audio = new Audio(src);
    audio.volume = 1;
    audio.onended = finish;
    audio.onerror = finish;
    onChange?.(name);
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(finish);
    return true;
  };

  return {
    start,
    stop: finish,
    get current() {
      return current;
    },
  };
}
