import { useCallback, useEffect, useRef, useState } from "react";

// Timer fokus untuk SATU catatan dalam satu waktu.
// Hasil: { noteId, minutes, left, duration, running, ended, setMinutes, start, toggle, extend, stop }
//  - noteId   : catatan yang sedang difokuskan (null = tidak ada sesi)
//  - ended    : waktu habis, menunggu pengguna memilih "Selesai" atau "+5m"
const KEY = "focus-minutes";
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 120;
export const STEP_MINUTES = 5;
export const clampMinutes = (n) =>
  Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(Number(n)) || 25));

function loadMinutes() {
  try {
    return clampMinutes(localStorage.getItem(KEY) || 25);
  } catch {
    return 25;
  }
}

export function useFocus(onEnd) {
  const [minutes, setMinutesState] = useState(loadMinutes);
  const [noteId, setNoteId] = useState(null);
  const [duration, setDuration] = useState(0);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const endAt = useRef(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const idRef = useRef(null);
  idRef.current = noteId;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((endAt.current - Date.now()) / 1000),
      );
      setLeft(remaining);
      if (remaining === 0) {
        setRunning(false);
        setEnded(true);
        endRef.current?.(idRef.current);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const setMinutes = useCallback((n) => {
    const m = clampMinutes(n);
    setMinutesState(m);
    try {
      localStorage.setItem(KEY, String(m));
    } catch {
      // penyimpanan tidak tersedia, abaikan
    }
  }, []);

  // Mulai fokus di satu catatan. Ditolak kalau sudah ada sesi di catatan lain.
  const start = useCallback(
    (id) => {
      if (!id || (idRef.current && idRef.current !== id)) return;
      const sec = minutes * 60;
      endAt.current = Date.now() + sec * 1000;
      setNoteId(id);
      setDuration(sec);
      setLeft(sec);
      setEnded(false);
      setRunning(true);
    },
    [minutes],
  );

  const toggle = useCallback(() => {
    if (!idRef.current || ended) return;
    if (running) {
      setRunning(false);
    } else {
      endAt.current = Date.now() + left * 1000;
      setRunning(true);
    }
  }, [running, ended, left]);

  // Tambah waktu (juga dipakai setelah waktu habis untuk lanjut mengerjakan)
  const extend = useCallback(
    (min = 5) => {
      if (!idRef.current) return;
      const add = min * 60;
      setDuration((d) => d + add);
      if (ended || left === 0) {
        endAt.current = Date.now() + add * 1000;
        setLeft(add);
        setEnded(false);
        setRunning(true);
      } else {
        endAt.current += add * 1000;
        setLeft((l) => l + add);
      }
    },
    [ended, left],
  );

  const stop = useCallback(() => {
    setRunning(false);
    setEnded(false);
    setNoteId(null);
    setLeft(0);
    setDuration(0);
  }, []);

  return {
    noteId,
    minutes,
    left,
    duration,
    running,
    ended,
    setMinutes,
    start,
    toggle,
    extend,
    stop,
  };
}
