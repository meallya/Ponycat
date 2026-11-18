import { useEffect, useRef, useState } from "react";
import "./compass.css";
import { LOCATION } from "../lib/prayer.js";
import { qiblaBearing, compassPoint } from "../lib/qibla.js";

// Slide Kompas.
//  - Selalu menampilkan arah kiblat dari LOCATION (lib/prayer.js), dihitung offline.
//  - Kalau perangkat punya sensor kompas (tablet / 2-in-1), piringan berputar mengikuti arah
//    hadap perangkat dan ada petunjuk "putar ke kanan/kiri" sampai sejajar kiblat.
//  - Kalau tidak ada sensor (kebanyakan PC), piringan diam dengan utara (N) di atas.

const QIBLA = qiblaBearing(LOCATION.lat, LOCATION.lng);
const ALIGN_TOL = 5; // derajat: dianggap sejajar kiblat
const SMOOTH = 0.3; // 0..1: makin kecil makin halus tapi makin lambat

const norm = (d) => ((d % 360) + 360) % 360;
// Selisih sudut terpendek, -180..180 (positif = searah jarum jam)
const signed = (d) => (((d % 360) + 540) % 360) - 180;

// Sudut berkesinambungan: 359° -> 1° tidak memutar balik 358°, tapi lanjut 2° searah.
function useContinuous(deg) {
  const ref = useRef(deg);
  ref.current += signed(deg - ref.current);
  return ref.current;
}

const C = 70; // pusat piringan (viewBox 140 x 140)
const RING_R = 57;

const TICKS = Array.from({ length: 36 }, (_, i) => {
  const a = i * 10;
  const major = a % 30 === 0;
  const len = major ? 7 : 4;
  return (
    <line
      key={a}
      className={`cmp-tick${major ? " maj" : ""}`}
      x1={C}
      y1={C - RING_R + 1}
      x2={C}
      y2={C - RING_R + 1 + len}
      transform={`rotate(${a} ${C} ${C})`}
    />
  );
});

const LABEL_R = 40;
const LABELS = [
  { t: "N", x: C, y: C - LABEL_R, n: true },
  { t: "E", x: C + LABEL_R, y: C },
  { t: "S", x: C, y: C + LABEL_R },
  { t: "W", x: C - LABEL_R, y: C },
].map((l) => (
  <text key={l.t} className={`cmp-lbl${l.n ? " n" : ""}`} x={l.x} y={l.y}>
    {l.t}
  </text>
));

const NO_SENSOR = new Set(["no_sensor", "api_unavailable", "no_bridge"]);

export default function CompassSlide({ active = true }) {
  const [data, setData] = useState(null); // pesan terakhir dari main process
  const [heading, setHeading] = useState(null); // arah hadap yang sudah dihaluskan, atau null
  const vec = useRef(null);

  // Pesan dari main process
  useEffect(() => {
    const api = window.island?.compass;
    if (!api) {
      setData({ ok: false, error: "no_bridge" });
      return;
    }
    return api.onUpdate((d) => setData(d));
  }, []);

  // Sensor hanya dibaca selama slide ini yang tampil
  useEffect(() => {
    const api = window.island?.compass;
    if (!api || !active) return;
    let alive = true;
    api
      .start()
      .then((d) => alive && d && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
      api.stop();
    };
  }, [active]);

  // Haluskan arah lewat rata-rata vektor (aman di batas 359° -> 0°)
  useEffect(() => {
    if (!data?.ok || typeof data.heading !== "number") {
      vec.current = null;
      setHeading(null);
      return;
    }
    const r = (data.heading * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const v = vec.current;
    vec.current = v
      ? { x: v.x + SMOOTH * (c - v.x), y: v.y + SMOOTH * (s - v.y) }
      : { x: c, y: s };
    setHeading(norm((Math.atan2(vec.current.y, vec.current.x) * 180) / Math.PI));
  }, [data]);

  const live = heading !== null;
  const rose = useContinuous(live ? -heading : 0);
  const diff = live ? signed(QIBLA - heading) : 0;
  const aligned = live && Math.abs(diff) <= ALIGN_TOL;
  const err = data && data.ok === false ? data.error : null;

  let hint = null;
  if (!live) {
    if (err && NO_SENSOR.has(err)) {
      hint =
        "Perangkat ini tidak punya sensor kompas, jadi yang tampil arah kiblat dari utara (N di atas).";
    } else if (err === "helper_exit") {
      hint = "Sensor kompas berhenti merespons. Buka slide ini lagi untuk mencoba.";
    } else {
      hint = "Mencari sensor kompas…";
    }
  }

  return (
    <div className={`cmp${aligned ? " ok" : ""}`}>
      <svg className="cmp-dial" viewBox="0 0 140 140" role="img" aria-label="Kompas">
        <g
          className="cmp-rose"
          style={{ transform: `rotate(${rose}deg)` }}
        >
          <circle className="cmp-ring" cx={C} cy={C} r={RING_R} />
          {TICKS}
          {/* jarum kiblat (ikut berputar bersama piringan) */}
          <g transform={`rotate(${QIBLA} ${C} ${C})`}>
            <line className="cmp-needle-line" x1={C} y1={C} x2={C} y2={C - 24} />
            <path
              className="cmp-needle"
              d={`M${C} ${C - 34} L${C + 5} ${C - 22} L${C - 5} ${C - 22} Z`}
            />
            <rect
              className="cmp-kaaba"
              x={C - 4.5}
              y={C - RING_R - 4.5}
              width="9"
              height="9"
              rx="1.6"
            />
          </g>
          {LABELS}
          <circle className="cmp-hub" cx={C} cy={C} r="3" />
        </g>
        {/* penanda tetap: bagian atas perangkat */}
        <path className="cmp-lubber" d="M65 0.5 L75 0.5 L70 8 Z" />
      </svg>

      <div className="cmp-info">
        <div className="cmp-kicker">Arah kiblat</div>
        <div className="cmp-big">
          <span className="cmp-deg">{Math.round(QIBLA) % 360}°</span>
          <span className="cmp-pt">{compassPoint(QIBLA)}</span>
        </div>
        <div className="cmp-place">{LOCATION.name}</div>

        {live ? (
          <>
            <div className={`cmp-status${aligned ? " ok" : ""}`}>
              {aligned
                ? "Sejajar dengan kiblat ✓"
                : `Putar ${Math.round(Math.abs(diff))}° ke ${diff > 0 ? "kanan" : "kiri"}`}
            </div>
            <div className="cmp-sub">
              Arah hadap {Math.round(heading) % 360}° {compassPoint(heading)}
              {data?.demo ? " · demo" : ""}
            </div>
            {data?.accuracy === "unreliable" && (
              <div className="cmp-sub">
                Kurang akurat: gerakkan perangkat membentuk angka 8
              </div>
            )}
          </>
        ) : (
          <div className="cmp-status hint">{hint}</div>
        )}
      </div>
    </div>
  );
}
