// Tampilan slide Prayer (hanya tampilan; logika waktu dan adzan ada di PrayerSlide.jsx).
// Semua data datang lewat props. Teks ada di objek T: ganti sesuai selera.
// Ukuran dirancang untuk slide 560 x 152 (BASE_EXPANDED.w x SLIDE_H di lib/layout.js).

const T = {
  today: "hari ini",
  tomorrow: "besok",
  changePlace: "Ganti lokasi",
  quran: "Baca Al-Qur'an",
  mode: { adzan: "Adzan", tone: "Nada", silent: "Senyap" },
  remind: "10 menit sebelum",
  playing: "Adzan",
  stop: "Berhenti",
};

const MODES = ["adzan", "tone", "silent"];

const Svg = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  />
);

const IconOut = () => (
  <Svg>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Svg>
);

const IconPin = () => (
  <Svg>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
);

// Busur lintasan matahari: garis titik-titik, satu penanda per waktu sholat.
// Sholat berikutnya diberi cincin, penanda terakhir (Isya) memakai ikon bulan.
const ARC_W = 300;
const ARC_H = 34;
const ARC_Y0 = 30; // tinggi ujung busur
const ARC_YC = -23; // titik kendali (makin kecil = busur makin tinggi)

function Arc({ items }) {
  const n = items.length;
  const pts = items.map((it, i) => {
    const t = (i + 0.5) / n;
    return {
      ...it,
      last: i === n - 1,
      x: t * ARC_W,
      y: ARC_Y0 + 2 * t * (1 - t) * (ARC_YC - ARC_Y0),
    };
  });
  return (
    <svg
      className="salat-arc"
      viewBox={`0 0 ${ARC_W} ${ARC_H}`}
      aria-hidden="true"
    >
      <defs>
        {/* lubangi garis putus-putus di sekitar penanda supaya tidak menumpuk */}
        <mask
          id="salat-arc-mask"
          maskUnits="userSpaceOnUse"
          x="0"
          y="-10"
          width={ARC_W}
          height={ARC_H + 20}
        >
          <rect x="0" y="-10" width={ARC_W} height={ARC_H + 20} fill="#fff" />
          {pts.map((p) => (
            <circle
              key={p.name}
              cx={p.x}
              cy={p.y}
              r={p.state === "next" ? 12 : p.last ? 11 : 6.5}
              fill="#000"
            />
          ))}
        </mask>
      </defs>
      <path
        className="salat-arc-line"
        mask="url(#salat-arc-mask)"
        d={`M0 ${ARC_Y0} Q${ARC_W / 2} ${ARC_YC} ${ARC_W} ${ARC_Y0}`}
      />
      {pts.map((p) => {
        if (p.state === "next") {
          return (
            <g key={p.name}>
              <circle className="salat-ring" cx={p.x} cy={p.y} r="8.4" />
              <circle className="salat-core" cx={p.x} cy={p.y} r="2.6" />
            </g>
          );
        }
        if (p.last) {
          return (
            <g key={p.name} className={`salat-moon ${p.state}`}>
              <circle cx={p.x} cy={p.y} r="7.4" />
              <path
                transform={`translate(${p.x - 4.2} ${p.y - 4.2}) scale(0.35)`}
                d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"
              />
            </g>
          );
        }
        return (
          <circle
            key={p.name}
            className={`salat-dot ${p.state}`}
            cx={p.x}
            cy={p.y}
            r="2.9"
          />
        );
      })}
    </svg>
  );
}

export default function PrayerView({
  nextName,
  countdown,
  nextAt, // jam sholat berikutnya, mis. "04:10"
  nextIsTomorrow,
  place,
  sub, // teks kecil di bawah nama lokasi (mis. tanggal hijriah)
  info = [], // potongan teks baris atas kanan, mis. ["Imsak 04:01", "Terbit 05:24"]
  prayers, // [{ name, time, state: "next" | "past" | "later" }]
  playingName,
  onStop,
  mode,
  onMode,
  remind,
  onRemind,
  onQuran,
  onChangePlace, // opsional: tombol hanya muncul kalau diberikan (kalau dipakai, lebarkan kolom kiri di prayer.css)
}) {
  return (
    <div className="salat">
      <div className="salat-left">
        <div>
          <div className="salat-next">{nextName}</div>
          <div className="salat-bigrow">
            <span className="salat-count">{countdown}</span>
            {nextAt && (
              <span className="salat-at">
                <b>{nextAt}</b>
                <span>{nextIsTomorrow ? T.tomorrow : T.today}</span>
              </span>
            )}
          </div>
        </div>

        <div className="salat-place">
          <b>{place}</b>
          {sub && <span>{sub}</span>}
        </div>

        <div className="salat-actions">
          {onChangePlace && (
            <button type="button" className="salat-btn" onClick={onChangePlace}>
              {T.changePlace}
            </button>
          )}
          <button type="button" className="salat-btn" onClick={onQuran}>
            <IconOut />
            {T.quran}
          </button>
        </div>
      </div>

      <div className="salat-right">
        {playingName ? (
          <div className="salat-playing">
            <span>
              {T.playing} {playingName}
            </span>
            <button type="button" className="salat-stop" onClick={onStop}>
              {T.stop}
            </button>
          </div>
        ) : (
          <div className="salat-info">
            {info.map((s, i) => (
              <span key={s}>
                {i > 0 && <i>·</i>}
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="salat-track">
          <Arc items={prayers} />
          <div className="salat-names" style={{ "--n": prayers.length }}>
            {prayers.map((p) => (
              <div key={p.name} className={`salat-pcell ${p.state}`}>
                <span className="salat-pname">{p.name}</span>
                <span className="salat-ptime">{p.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="salat-controls">
          <div
            className="salat-seg"
            role="radiogroup"
            aria-label="Mode pengingat sholat"
            style={{ "--i": Math.max(0, MODES.indexOf(mode)) }}
          >
            {/* pil penanda: meluncur ke tombol aktif lewat transform (lihat .salat-thumb di prayer.css) */}
            <span className="salat-thumb" aria-hidden="true" />
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                className={mode === m ? "on" : ""}
                onClick={() => onMode(m)}
              >
                {T.mode[m]}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={remind}
            className={`salat-remind ${remind ? "on" : ""}`}
            onClick={onRemind}
          >
            <span>{T.remind}</span>
            <span className="salat-switch" />
          </button>
        </div>
      </div>
    </div>
  );
}
