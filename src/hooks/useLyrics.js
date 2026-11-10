import { useEffect, useRef, useState } from "react";
import { loadLyrics, findLine } from "../lib/lyrics.js";

// Fine-tune sinkron lirik (detik): naikkan kalau lirik terasa TELAT, turunkan kalau KECEPETAN.
// Windows SMTC position sering sedikit di belakang audio aktual, jadi lead default lebih besar.
export const LYRIC_LEAD = 0.65;

const clamp = (v, max) => Math.max(0, max > 0 ? Math.min(v, max) : v);

// Indeks baris lirik yang sedang dinyanyikan; -1 kalau belum mulai / tidak ada lirik ber-timestamp.
export function lineAt(lyrics, media) {
  if (!lyrics?.synced || !media?.hasSession) return -1;
  const elapsed =
    media.status === "playing"
      ? (performance.now() - media.receivedAt) / 1000
      : 0;
  const pos = clamp(media.position + elapsed, media.duration);
  return findLine(lyrics.lines, pos + LYRIC_LEAD);
}

// Ambil lirik untuk lagu yang sedang diputar (dicocokkan dengan durasi + romanisasi bahasa asing).
// Hasil: undefined = sedang dicari, null = tidak ada, { synced, lines } = ada.
// Durasi kadang baru terbaca setelah judul, jadi lirik lama tidak dikosongkan
// kalau hanya durasinya yang berubah.
export function useLyrics(media) {
  const [lyrics, setLyrics] = useState(null);
  const trackKeyRef = useRef("");

  const hasSession = Boolean(media?.hasSession);
  const title = media?.title || "";
  const artist = media?.artist || "";
  const album = media?.album || "";
  const duration = Math.round(media?.duration || 0);
  const trackKey = `${title}|${artist}`;

  useEffect(() => {
    if (!hasSession || !title) {
      trackKeyRef.current = "";
      setLyrics(null);
      return;
    }
    if (trackKeyRef.current !== trackKey) {
      trackKeyRef.current = trackKey;
      setLyrics(undefined);
    }
    let cancelled = false;
    loadLyrics({ title, artist, album, duration }).then((res) => {
      if (!cancelled) setLyrics(res);
    });
    return () => {
      cancelled = true;
    };
  }, [trackKey, album, duration, hasSession]); // eslint-disable-line react-hooks/exhaustive-deps

  return lyrics;
}

// Baris lirik aktif untuk ditampilkan. Hanya berdetak saat lagu diputar.
export function useLyricIndex(lyrics, media) {
  const [idx, setIdx] = useState(() => lineAt(lyrics, media));

  useEffect(() => {
    setIdx(lineAt(lyrics, media));
    if (!lyrics?.synced || media?.status !== "playing") return;
    let id;
    let last = 0;
    const loop = (t) => {
      if (t - last >= 50) {
        last = t;
        setIdx(lineAt(lyrics, media));
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [lyrics, media]);

  return idx;
}
