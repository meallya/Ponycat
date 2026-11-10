// Jadwal sholat offline (tanpa internet) + tanggal Hijriah + helper format.
// Dependency: npm i adhan

import {
  Coordinates,
  CalculationParameters,
  Madhab,
  Rounding,
  PrayerTimes,
} from "adhan";

// ====== PENGATURAN ======================================================
export const LOCATION = {
  name: "Serang - Banten",
  lat: -6.12,
  lng: 106.15,
  tz: "Asia/Jakarta",
};

// Koreksi per waktu (menit). Sudah disetel agar hasilnya sama dengan jadwal
// referensi 5 Nov 2026 (Imsak 04:00, Subuh 04:10, Dzuhur 11:42, Ashar 15:00,
// Maghrib 17:52, Isya 19:01). Kalau di hari lain meleset 1 menit, ubah di sini.
export const ADJUST = { fajr: 2, dhuhr: 3, asr: 3, maghrib: 2, isha: -1 };

// Geser tanggal Hijriah (-1 / 0 / +1) kalau berbeda sehari dengan kalender yang kamu pakai.
export const HIJRI_ADJUST_DAYS = 0;
// =========================================================================

export const ADZAN_NAMES = ["Subuh", "Dzuhur", "Ashar", "Maghrib", "Isya"];
export const ROW_NAMES = ["Imsak", ...ADZAN_NAMES];

const pad = (n) => String(n).padStart(2, "0");

function parts(date, tz, opts, locale = "en-US") {
  return Object.fromEntries(
    new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
}

// 'YYYY-MM-DD' menurut zona waktu lokasi
export function dayKey(date = new Date(), tz = LOCATION.tz) {
  const p = parts(date, tz, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const dayCache = new Map();

// Semua waktu pada tanggal tsb sebagai objek Date: Imsak, Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya
export function timesForDay(key) {
  if (dayCache.has(key)) return dayCache.get(key);
  const [y, m, d] = key.split("-").map(Number);
  const params = new CalculationParameters(null, 20, 18); // sudut Subuh 20°, Isya 18°
  params.madhab = Madhab.Shafi;
  params.rounding = Rounding.Up;
  params.adjustments = {
    fajr: 0,
    sunrise: 0,
    dhuhr: 0,
    asr: 0,
    maghrib: 0,
    isha: 0,
    ...ADJUST,
  };
  const t = new PrayerTimes(
    new Coordinates(LOCATION.lat, LOCATION.lng),
    new Date(y, m - 1, d),
    params,
  );
  const res = {
    Imsak: new Date(t.fajr.getTime() - 10 * 60000),
    Subuh: t.fajr,
    Terbit: t.sunrise,
    Dzuhur: t.dhuhr,
    Ashar: t.asr,
    Maghrib: t.maghrib,
    Isya: t.isha,
  };
  dayCache.set(key, res);
  return res;
}

// Waktu sholat berikutnya (setelah Isya -> Subuh besok)
export function nextPrayer(now = new Date()) {
  const key = dayKey(now);
  const today = timesForDay(key);
  for (const name of ADZAN_NAMES) {
    if (today[name] > now) return { name, at: today[name], tomorrow: false };
  }
  return {
    name: "Subuh",
    at: timesForDay(addDays(key, 1)).Subuh,
    tomorrow: true,
  };
}

// Sholat yang waktunya baru saja masuk dan belum diadzankan.
// `grace` = toleransi telat (ms) supaya tidak adzan kalau aplikasi baru dibuka lama setelah waktunya.
export function dueAdzan(now, fired, grace = 90_000) {
  const key = dayKey(now);
  const times = timesForDay(key);
  for (const name of ADZAN_NAMES) {
    const diff = now - times[name];
    const id = `${key}|${name}`;
    if (diff >= 0 && diff < grace && !fired.has(id)) return { name, id };
  }
  return null;
}

// 04:10 AM -> { time: '04:10', ampm: 'AM' }
export function fmt12(date, tz = LOCATION.tz) {
  const p = parts(date, tz, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return {
    time: `${p.hour}:${p.minute}`,
    ampm: String(p.dayPeriod || "").toUpperCase(),
  };
}

export function fmtCountdown(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${pad(h)}:${pad(m)}:${pad(s % 60)}`;
}

const HIJRI_MONTHS = [
  "Muharram",
  "Safar",
  "Rabiul-Awal",
  "Rabiul-Akhir",
  "Jumadil-Awal",
  "Jumadil-Akhir",
  "Rajab",
  "Syaban",
  "Ramadan",
  "Syawal",
  "Dzulkaidah",
  "Dzulhijjah",
];

// "25 Jumadil-Awal 1448 H"
export function hijriLabel(now = new Date(), tz = LOCATION.tz) {
  const shifted = new Date(now.getTime() + HIJRI_ADJUST_DAYS * 86400000);
  const p = parts(
    shifted,
    tz,
    { day: "numeric", month: "numeric", year: "numeric" },
    "en-u-ca-islamic-umalqura",
  );
  return `${p.day} ${HIJRI_MONTHS[Number(p.month) - 1] || p.month} ${p.year} H`;
}
