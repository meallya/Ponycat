import { useEffect, useState } from "react";

// Wajah kucing untuk notch "Ponycat" (ukuran dasar 168 x 34, lihat BASE_COMPACT di layout.js).
// Sama dengan ucing di ikon aplikasi: badan hitam menyatu dengan notch, mata bulat dengan
// cincin kuning dan kilau putih, pipi pink bergaris, dan dua kumis putih tipis di tiap sisi.
// Mata melirik pelan dan berkedip, pipi "bernapas" pelan.
// Warna mata bisa diganti lewat CSS variable --cat-eye (default kuning seperti di ikon).

const W = 128; // lebar kanvas wajah (koordinat di bawah dihitung untuk lebar ini)
const H = 34;
const CX = W / 2; // sumbu tengah wajah
// Lebar notch tertutup. Wajah digeser ke tengah, sisa ruang jadi napas di kiri-kanan.
const NOTCH_W = 168;
const PAD_X = (NOTCH_W - W) / 2;
const BASE_Y = 17; // pusat mata (naik/turunkan untuk geser vertikal)
const EYES_X = [49, 79]; // pusat tiap mata (jauhkan = lebih lega, dekatkan = lebih imut)
const R = 5.6; // jari-jari cincin mata saat terbuka
const RING_W = 1.1; // ketebalan cincin

const CHEEK_X = [32, 96]; // pusat pipi kiri & kanan
const CHEEK_Y = 22.5;
const CHEEK_STROKES = [-2.1, 0, 2.1]; // posisi tiap goresan pink dari pusat pipi

// Kumis sisi kiri; sisi kanan dicerminkan otomatis. Tiap kumis: kurva dari ujung luar ke arah mata.
// Ujung dalamnya berhenti sekitar 5 satuan sebelum cincin mata supaya tidak menempel.
const WHISKERS = ["M24.5 10 Q31 10.6 37.5 14", "M27.5 15.4 Q32 15.5 36.5 16.6"];

// Arah lirikan [x, y], masing-masing -1..1. Posisi tengah sengaja paling sering.
const GAZES = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [-1, 0],
  [1, 0],
  [-1, -0.5],
  [1, -0.5],
  [0, -0.7],
];

// Tinggi cincin per frame saat berkedip (1 = terbuka penuh).
const BLINK_FRAMES = [0.45, 0.1, 0.1, 0.45, 1];

const rand = (a, b) => a + Math.random() * (b - a);
const f = (n) => n.toFixed(2);

const CSS = `
.cat-move { transition: transform 300ms cubic-bezier(.25,.8,.3,1); }
.cat-ring, .cat-halo { fill: none; stroke: var(--cat-eye, #ffe933); }
.cat-halo { opacity: .5; }
.cat-whisker { fill: none; stroke: #fff; stroke-width: .7; stroke-linecap: round; opacity: .8; }
.cat-cheek path { fill: none; stroke: #ff9dca; stroke-width: 1.7; stroke-linecap: round; }
.cat-cheek .halo { stroke-width: 2.6; opacity: .3; }
.cat-cheek .main { opacity: .92; }
@media (prefers-reduced-motion: no-preference) {
  .cat-halo { animation: cat-breathe 4s ease-in-out infinite; }
  .cat-cheek { animation: cat-blush 5s ease-in-out infinite; }
}
@keyframes cat-breathe { 0%, 100% { opacity: .38; } 50% { opacity: .6; } }
@keyframes cat-blush { 0%, 100% { opacity: .78; } 50% { opacity: 1; } }
`;

// lid = tinggi cincin (0..1). hx/hy = geseran kilau supaya mata terasa "melihat" ke arah lirikan.
function Eye({ cx, lid, hx, hy }) {
  const ry = Math.max(0.35, R * lid);
  const open = lid > 0.55;
  return (
    <g transform={`translate(${cx} ${BASE_Y})`}>
      <ellipse
        className="cat-halo"
        rx={R}
        ry={ry}
        filter="url(#cat-blur)"
        style={{ strokeWidth: RING_W + 1.2 }}
      />
      <ellipse
        className="cat-ring"
        rx={R}
        ry={ry}
        style={{ strokeWidth: RING_W }}
      />
      {/* dua kilau putih di bagian atas, tetap di dalam cincin saat menyipit */}
      <g style={{ opacity: open ? 1 : 0 }}>
        <circle
          cx={f(0.06 * R + hx)}
          cy={f((-0.59 * R + hy) * lid)}
          r={f(0.165 * R)}
          fill="#fff"
        />
        <circle
          cx={f(0.29 * R + hx)}
          cy={f((-0.43 * R + hy) * lid)}
          r={f(0.08 * R)}
          fill="#fff"
        />
      </g>
    </g>
  );
}

// Pipi: tiga goresan miring, kiri "///" dan kanan "\\\" (saling cermin).
function Cheek({ cx, side }) {
  const d = CHEEK_STROKES.map(
    (x) => `M${f(x + side * 1)} 1.5 L${f(x - side * 1)} -1.5`,
  ).join(" ");
  return (
    <g className="cat-cheek" transform={`translate(${cx} ${CHEEK_Y})`}>
      <path
        className="halo"
        d={d}
        filter="url(#cat-blur-s)"
        style={{ stroke: "#ff9dca" }}
      />
      <path className="main" d={d} />
    </g>
  );
}

function Whiskers() {
  return (
    <>
      {WHISKERS.map((d) => (
        <path key={d} className="cat-whisker" d={d} />
      ))}
      <g transform={`translate(${W} 0) scale(-1 1)`}>
        {WHISKERS.map((d) => (
          <path key={d} className="cat-whisker" d={d} />
        ))}
      </g>
    </>
  );
}

export default function CatFace() {
  const [gaze, setGaze] = useState([0, 0]);
  const [lid, setLid] = useState(1);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return; // diam saja
    let alive = true;
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };

    const look = () => {
      setGaze(GAZES[Math.floor(Math.random() * GAZES.length)]);
      later(look, rand(1200, 3800));
    };

    const playBlink = (i, onEnd) => {
      setLid(BLINK_FRAMES[i]);
      if (i < BLINK_FRAMES.length - 1) {
        later(() => playBlink(i + 1, onEnd), 55);
      } else {
        onEnd?.();
      }
    };
    const blinkLoop = () => {
      const double = Math.random() < 0.2; // kadang kedip dua kali
      playBlink(0, () => {
        if (double) later(() => playBlink(0), 140);
      });
      later(blinkLoop, rand(2600, 6200));
    };

    later(look, 800);
    later(blinkLoop, 1800);

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  const [gx, gy] = gaze;

  return (
    <svg
      viewBox={`0 0 ${NOTCH_W} ${H}`}
      role="img"
      aria-label="Wajah kucing"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <style>{CSS}</style>
      <defs>
        {/* userSpaceOnUse supaya glow tidak terpotong saat cincin mata menyipit */}
        <filter
          id="cat-blur"
          filterUnits="userSpaceOnUse"
          x="-14"
          y="-14"
          width="28"
          height="28"
        >
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <filter
          id="cat-blur-s"
          filterUnits="userSpaceOnUse"
          x="-14"
          y="-14"
          width="28"
          height="28"
        >
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      <g transform={`translate(${PAD_X} 0)`}>
      {/* mata bergeser lebih jauh daripada pipi dan kumis: kesan kedalaman halus */}
      <g
        className="cat-move"
        style={{ transform: `translate(${gx * 1.6}px, ${gy * 0.9}px)` }}
      >
        {EYES_X.map((x) => (
          <Eye key={x} cx={x} lid={lid} hx={gx * 0.4} hy={gy * 0.3} />
        ))}
      </g>
      <g
        className="cat-move"
        style={{ transform: `translate(${gx * 0.6}px, ${gy * 0.3}px)` }}
      >
        <Whiskers />
        {CHEEK_X.map((x) => (
          <Cheek key={x} cx={x} side={x < CX ? -1 : 1} />
        ))}
      </g>
      </g>
    </svg>
  );
}
