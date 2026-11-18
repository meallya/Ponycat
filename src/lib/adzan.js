// Pemutar adzan: saat adzan mulai, musik yang sedang jalan di-pause;
// saat adzan selesai (atau dihentikan), musik dilanjutkan otomatis.
//
//   command(c) -> kirim perintah ke pemutar musik: 'pause' saat adzan mulai, 'resume' saat selesai.
//                 Sisi Electron mengingat pemutar mana yang di-pause, jadi 'resume' tidak akan
//                 menyalakan musik yang memang sudah berhenti sebelum adzan.
//   onChange(n) -> dipanggil dengan nama sholat saat mulai, dan null saat selesai

export function createAdzanPlayer({ command, onChange }) {
  let audio = null;
  let current = null;

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
    command?.("resume");
    onChange?.(null);
  };

  const start = (name, src) => {
    if (current || !src) return false;
    current = name;
    // Dikirim tanpa melihat status: status dari Windows bisa telat beberapa detik
    command?.("pause");
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
