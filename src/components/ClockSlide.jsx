import { useEffect, useMemo, useState } from "react";
import { dateKey } from "../lib/dates.js";

// Nama hari/bulan ditulis manual (bukan toLocaleDateString), jadi tampil
// berbahasa Indonesia di laptop mana pun, apa pun bahasa Windows-nya.
const DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const WEEK_STARTS_ON = 0; // 0 = Minggu di kolom pertama, 1 = Senin
const TODAY_COLOR = "#ff9f0a"; // oranye yang sama dengan tombol play di slide Timer
const SUNDAY_COLOR = "#ff6b63";
const CELL_W = 30;
const CELL_H = 20;

const pad = (n) => String(n).padStart(2, "0");

// Daftar sel untuk satu bulan: null = kotak kosong, angka = tanggal.
// Panjangnya selalu kelipatan 7 (4 sampai 6 baris).
function buildMonth(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Minggu
  const lead = (firstWeekday - WEEK_STARTS_ON + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function ClockSlide({ notes = [], onOpenDate }) {
  const [now, setNow] = useState(() => new Date());
  // 0 = bulan ini, -1 = bulan lalu, +1 = bulan depan, dst.
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let id;
    const tick = () => {
      setNow(new Date());
      id = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    tick();
    return () => clearTimeout(id);
  }, []);

  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const today = offset === 0 ? now.getDate() : 0; // 0 = tidak ada "hari ini" di bulan ini
  // Jumlah catatan (yang ada isinya) per tanggal, untuk titik penanda
  const counts = useMemo(() => {
    const m = new Map();
    for (const n of notes) {
      if (n.date && (n.text || "").trim())
        m.set(n.date, (m.get(n.date) || 0) + 1);
    }
    return m;
  }, [notes]);
  const todayWeekday = now.getDay();
  const cells = buildMonth(year, month);
  const weekdays = Array.from(
    { length: 7 },
    (_, i) => (WEEK_STARTS_ON + i) % 7,
  );

  return (
    <div
      className="clock-slide"
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 44,
      }}
    >
      <div className="clock-big">
        {pad(now.getHours())}:{pad(now.getMinutes())}
        <span className="clock-sec">{pad(now.getSeconds())}</span>
      </div>

      <div
        className="cal"
        aria-label={`Kalender ${MONTHS[month]} ${year}`}
        style={{ width: CELL_W * 7 }}
      >
        <div className="cal-head">
          <button
            type="button"
            className="cal-title"
            title="Kembali ke bulan ini"
            onClick={() => setOffset(0)}
          >
            {MONTHS[month]} {year}
          </button>
          <span className="cal-nav-group">
            <button
              type="button"
              className="cal-nav"
              aria-label="Bulan sebelumnya"
              onClick={() => setOffset((o) => o - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="cal-nav"
              aria-label="Bulan berikutnya"
              onClick={() => setOffset((o) => o + 1)}
            >
              ›
            </button>
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(7, ${CELL_W}px)`,
            gridAutoRows: CELL_H,
            alignItems: "center",
            justifyItems: "center",
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {weekdays.map((d) => (
            <div
              key={`h${d}`}
              style={{
                fontSize: 10,
                fontWeight: d === todayWeekday ? 600 : 400,
                color:
                  d === todayWeekday
                    ? "#fff"
                    : d === 0
                      ? SUNDAY_COLOR
                      : "rgba(255,255,255,0.45)",
              }}
            >
              {DAYS_SHORT[d]}
            </div>
          ))}

          {cells.map((d, i) => {
            if (d === null) return <div key={`b${i}`} />;
            const isToday = d === today;
            const isSunday = (WEEK_STARTS_ON + (i % 7)) % 7 === 0;
            const key = dateKey(year, month, d);
            const count = counts.get(key) || 0;
            return (
              <button
                type="button"
                key={d}
                className="cal-day"
                aria-current={isToday ? "date" : undefined}
                aria-label={`${d} ${MONTHS[month]} ${year}, ${count ? `${count} catatan` : "buat catatan"}`}
                title={count ? `${count} catatan` : "Buat catatan"}
                onClick={() => onOpenDate?.(key)}
                style={{
                  position: "relative",
                  width: CELL_H,
                  height: CELL_H,
                  padding: 0,
                  border: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: isToday ? TODAY_COLOR : "transparent",
                  color: isToday
                    ? "#000"
                    : isSunday
                      ? SUNDAY_COLOR
                      : "rgba(255,255,255,0.85)",
                  fontWeight: isToday ? 700 : 500,
                }}
              >
                {d}
                {count > 0 && (
                  <span
                    className="cal-dot"
                    style={{ background: isToday ? "#000" : "#5ac8fa" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
