// Tanggal untuk catatan yang terhubung ke kalender.
// Tanggal disimpan sebagai teks "YYYY-MM-DD" (waktu lokal), jadi aman dibandingkan,
// dan tidak bergeser hari karena zona waktu.

const pad = (n) => String(n).padStart(2, "0");

export const MONTHS_ID = [
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
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

// month: 0-11
export const dateKey = (year, month, day) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

export const todayKey = () => {
  const d = new Date();
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
};

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isDateKey = (v) => typeof v === "string" && RE.test(v);

function parse(key) {
  const m = RE.exec(key || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

// Geser n hari (boleh negatif); melewati batas bulan dan tahun dengan benar
export function shiftDate(key, n) {
  const d = parse(key);
  if (!d) return key;
  d.setDate(d.getDate() + n);
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

// "12 Nov", ditambah tahun kalau bukan tahun ini ("12 Nov 2027")
export function fmtShort(key) {
  const d = parse(key);
  if (!d) return "";
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear()
    ? base
    : `${base} ${d.getFullYear()}`;
}
