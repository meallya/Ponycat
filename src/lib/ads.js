// Deteksi iklan (Spotify gratis, YouTube, dll.) supaya lirik tidak ditampilkan saat iklan.
// Windows hanya memberi judul/artis/durasi, jadi dipakai beberapa petunjuk sekaligus.

const AD_WORDS =
  /\b(advertisement|advertisements|advert|sponsored|iklan|anuncio|publicidad|werbung|publicit[eé]|reklam|annons)\b/i;

// Petunjuk dari teks: judul/artis bertuliskan "Advertisement", atau Spotify tanpa artis
// (lagu asli selalu punya artis; iklan Spotify memakai "Spotify" atau kosong).
export function looksLikeAd(media) {
  if (!media?.hasSession) return false;
  const title = (media.title || "").trim();
  const artist = (media.artist || "").trim();
  if (AD_WORDS.test(title) || AD_WORDS.test(artist)) return true;

  const app = (media.app || "").toLowerCase();
  if (app.includes("spotify")) {
    if (!title) return false; // metadata belum masuk
    if (!artist || /^spotify$/i.test(artist) || /^spotify$/i.test(title)) {
      return true;
    }
  }
  return false;
}

// Petunjuk dari durasi: iklan di YouTube sering memakai judul video, tapi durasinya
// jauh lebih pendek daripada lagu yang liriknya ditemukan. Selisih besar = bukan lagu itu.
export function durationMismatch(media, lyrics) {
  const md = Number(media?.duration) || 0;
  const ld = Number(lyrics?.duration) || 0;
  if (md <= 0 || ld <= 0) return false;
  const diff = Math.abs(md - ld);
  return diff > 20 && diff / ld > 0.15;
}

export function isAdPlaying(media, lyrics) {
  return looksLikeAd(media) || durationMismatch(media, lyrics);
}
