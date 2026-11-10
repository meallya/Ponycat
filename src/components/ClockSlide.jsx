import { useEffect, useState } from "react";

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

export default function ClockSlide() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id;
    const tick = () => {
      setNow(new Date());
      id = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    tick();
    return () => clearTimeout(id);
  }, []);

  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
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
        aria-label={`Kalender ${MONTHS[month]} ${year}`}
        style={{ width: CELL_W * 7 }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          {MONTHS[month]} {year}
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
            return (
              <div
                key={d}
                aria-current={isToday ? "date" : undefined}
                style={{
                  width: CELL_H,
                  height: CELL_H,
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
