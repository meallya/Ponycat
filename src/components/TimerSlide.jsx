import { useEffect, useRef, useState } from "react";
import { IconPlay, IconPause, IconReset } from "./icons.jsx";
import { fmtTimer } from "../lib/format.js";

const PRESETS = [5, 10, 15, 25];
const MAX_MIN = 99; // tampilan MM:SS, jadi dibatasi 99 menit. Naikkan kalau fmtTimer mendukung jam.
const SHIFT_DOWN = 14; // px, geser seluruh isi slide ke bawah. Ubah angka ini kalau kurang/lebih.

const clampMin = (n) => Math.min(MAX_MIN, Math.max(1, n));

export default function TimerSlide({ timer }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  const state = timer.done ? "done" : timer.running ? "run" : "";

  // Chip terakhir: "Atur" kalau durasi sama dengan salah satu preset,
  // atau menampilkan durasi custom-nya (mis. "12m") kalau bukan.
  const isPreset = PRESETS.some((m) => timer.duration === m * 60);
  const customMin = timer.duration / 60;
  const customLabel = Number.isInteger(customMin)
    ? `${customMin}m`
    : fmtTimer(timer.duration);

  // Window island tidak bisa fokus secara default (lihat main.js), jadi keyboard
  // baru berfungsi setelah window dibuat focusable, sama seperti slide Notes.
  const grabKeyboard = async () => {
    await window.island?.setFocusable?.(true);
    inputRef.current?.focus();
  };

  const openEditor = async () => {
    setValue(String(clampMin(Math.round(timer.duration / 60))));
    await window.island?.setFocusable?.(true);
    setEditing(true);
  };

  const closeEditor = () => {
    setEditing(false);
    window.island?.setFocusable?.(false);
  };

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Timer mulai jalan atau selesai saat editor masih terbuka: tutup editornya
  useEffect(() => {
    if (editing && (timer.running || timer.done)) closeEditor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.running, timer.done]);

  const apply = () => {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) timer.preset(clampMin(n));
    closeEditor();
  };

  const step = (delta) =>
    setValue((v) => String(clampMin((parseInt(v, 10) || 0) + delta)));

  return (
    <div className="timer" style={{ transform: `translateY(${SHIFT_DOWN}px)` }}>
      <div className="timer-main">
        <button
          type="button"
          className="round"
          aria-label="Reset"
          onClick={timer.reset}
        >
          <IconReset />
        </button>
        <div className={`timer-digits ${state}`}>{fmtTimer(timer.left)}</div>
        <button
          type="button"
          className="round primary"
          aria-label={timer.running ? "Jeda" : "Mulai"}
          onClick={timer.toggle}
        >
          {timer.running ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
      </div>

      <div className="chips">
        {timer.done ? (
          <span className="chip-note">Waktu habis</span>
        ) : editing ? (
          <>
            <button
              type="button"
              className="chip"
              aria-label="Kurangi 1 menit"
              onClick={() => step(-1)}
            >
              −
            </button>
            <input
              ref={inputRef}
              className="chip"
              inputMode="numeric"
              aria-label="Durasi dalam menit"
              value={value}
              onChange={(e) =>
                setValue(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, String(MAX_MIN).length),
                )
              }
              onPointerDown={grabKeyboard}
              onKeyDown={(e) => {
                e.stopPropagation(); // jangan sampai carousel menangkap tombol panah/angka
                if (e.key === "Enter") apply();
                if (e.key === "Escape") closeEditor();
              }}
              style={{
                width: 56,
                textAlign: "center",
                border: "none",
                fontFamily: "inherit",
                cursor: "text",
              }}
            />
            <button
              type="button"
              className="chip"
              aria-label="Tambah 1 menit"
              onClick={() => step(1)}
            >
              +
            </button>
            <button type="button" className="chip on" onClick={apply}>
              OK
            </button>
            <button type="button" className="chip" onClick={closeEditor}>
              Batal
            </button>
          </>
        ) : (
          <>
            {PRESETS.map((m) => (
              <button
                type="button"
                key={m}
                className={`chip ${!timer.running && timer.duration === m * 60 ? "on" : ""}`}
                disabled={timer.running}
                onClick={() => timer.preset(m)}
              >
                {m}m
              </button>
            ))}
            <button
              type="button"
              className={`chip ${!timer.running && !isPreset ? "on" : ""}`}
              disabled={timer.running}
              onClick={openEditor}
            >
              {isPreset ? "Atur" : customLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
