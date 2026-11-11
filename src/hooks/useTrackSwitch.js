import { useCallback, useEffect, useRef, useState } from "react";

// Animasi loading saat lagu berganti.
//
//   begin()  -> panggil saat tombol Sebelumnya / Berikutnya ditekan: animasi langsung
//               tampil sampai lagu baru terbaca dari Windows (batas WAIT_MAX).
//   lagu baru terbaca (dari tombol, otomatis, atau dari pemutar) -> animasi tetap tampil
//               sampai liriknya selesai dicari (batas SETTLE_MAX), tapi minimal MIN_SHOW
//               supaya tidak berkedip kalau semuanya sudah ada di cache.
//
// `lyrics`: undefined = sedang dicari (lihat useLyrics).
const WAIT_MAX = 3500;
const MIN_SHOW = 700;
const SETTLE_MAX = 4000;

export function useTrackSwitch(media, lyrics) {
  const key =
    media?.hasSession && media.title
      ? `${media.app}|${media.title}|${media.artist}`
      : "";
  const [phase, setPhase] = useState("idle"); // idle | waiting | settling
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startedAt = useRef(0);
  const prevKey = useRef(key);

  const begin = useCallback(() => {
    startedAt.current = performance.now();
    setPhase("waiting");
  }, []);

  // Lagu berganti
  useEffect(() => {
    if (key === prevKey.current) return;
    const hadTrack = Boolean(prevKey.current);
    prevKey.current = key;
    if (!key || !hadTrack) {
      // Lagu pertama muncul, atau pemutar ditutup: tanpa animasi
      setPhase("idle");
      return;
    }
    if (phaseRef.current !== "waiting") startedAt.current = performance.now();
    setPhase("settling");
  }, [key]);

  // Menunggu lagu baru setelah tombol ditekan; menyerah kalau tidak ada yang berganti
  // (misalnya sudah di lagu terakhir).
  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setTimeout(() => setPhase("idle"), WAIT_MAX);
    return () => clearTimeout(t);
  }, [phase]);

  // Menunggu lirik lagu baru
  const lyricsReady = lyrics !== undefined;
  useEffect(() => {
    if (phase !== "settling") return;
    const elapsed = performance.now() - startedAt.current;
    const limit = lyricsReady ? MIN_SHOW : SETTLE_MAX;
    const t = setTimeout(() => setPhase("idle"), Math.max(0, limit - elapsed));
    return () => clearTimeout(t);
  }, [phase, lyricsReady]);

  return { switching: phase !== "idle", begin };
}
