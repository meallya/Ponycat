// Arah kiblat dari koordinat (derajat dari utara searah jarum jam) + mata angin 16 arah.
const KAABA = { lat: 21.4225, lon: 39.8262 };
const DIRS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];
const rad = (d) => (d * Math.PI) / 180;

export function qiblaBearing(lat, lon) {
  const p1 = rad(lat);
  const p2 = rad(KAABA.lat);
  const dl = rad(KAABA.lon - lon);
  const y = Math.sin(dl);
  const x = Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function compassPoint(deg) {
  return DIRS[Math.round(deg / 22.5) % 16];
}

// Contoh hasil: "295° WNW". Mengembalikan null kalau koordinat tidak valid.
export function qiblaLabel(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const d = qiblaBearing(lat, lon);
  return `${Math.round(d)}° ${compassPoint(d)}`;
}
