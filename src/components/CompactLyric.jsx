import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Eq from "./Eq.jsx";
import { useLyricIndex } from "../hooks/useLyrics.js";

// true = tampilkan romanisasi (kalau ada) dan bukan teks aslinya, mis. untuk lagu Korea/Jepang
const PREFER_ROMA = true;
// Baris yang lebih panjang dari notch digulir pelan; mulai bergulir setelah jeda ini (detik)
const SCROLL_DELAY = 0.35;

const CSS = `
.clyr { padding: 0 18px; }
.clyr-box { flex: 1; min-width: 0; overflow: hidden; text-align: center; white-space: nowrap; animation: clyr-in .22s ease-out both; }
.clyr-box.fade { -webkit-mask-image: linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent); mask-image: linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent); }
.clyr-text { display: inline-block; font-size: 12.5px; font-weight: 500; letter-spacing: -0.01em; color: rgba(255,255,255,.92); will-change: transform; }
@keyframes clyr-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
`;

// Satu baris lirik. Kalau kepanjangan, digulir dari awal sampai akhir selama baris itu dinyanyikan.
function LyricText({ text, span }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [shift, setShift] = useState(0); // berapa px yang tidak muat
  const [go, setGo] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (box && el)
      setShift(Math.max(0, Math.ceil(el.scrollWidth - box.clientWidth)));
  }, [text]);

  // Mulai menggulir satu frame setelah ukuran terukur, supaya transisinya benar-benar berjalan
  useEffect(() => {
    if (!shift) return;
    const id = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(id);
  }, [shift]);

  const duration = Math.max(1, span * 0.85 - SCROLL_DELAY);

  return (
    <div ref={boxRef} className={`clyr-box${shift ? " fade" : ""}`}>
      <span
        ref={textRef}
        className="clyr-text"
        style={{
          transform: go ? `translateX(-${shift}px)` : "none",
          transition: go
            ? `transform ${duration}s linear ${SCROLL_DELAY}s`
            : "none",
        }}
      >
        {text}
      </span>
    </div>
  );
}

// Isi notch tertutup saat lagu diputar dan liriknya punya timestamp.
// Di jeda instrumental (baris kosong) dan sebelum baris pertama, tampil equalizer seperti biasa.
export default function CompactLyric({ lyrics, media }) {
  const idx = useLyricIndex(lyrics, media);
  const line = idx >= 0 ? lyrics.lines[idx] : null;
  const text = line
    ? ((PREFER_ROMA && line.roma) || line.text || "").trim()
    : "";

  if (!text) {
    return (
      <div className="compact-inner">
        <Eq on />
      </div>
    );
  }

  const next = lyrics.lines[idx + 1];
  const span = next ? next.t - line.t : 4; // lama baris ini dinyanyikan (detik)

  return (
    <div className="compact-inner clyr">
      <style>{CSS}</style>
      {/* key = idx: setiap baris baru dipasang ulang, jadi animasi masuk dan ukurannya dihitung ulang */}
      <LyricText key={idx} text={text} span={span} />
    </div>
  );
}
