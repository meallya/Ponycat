// Ambil lirik dari LRCLIB, pilih versi yang paling cocok dengan lagu yang
// sedang diputar (judul + durasi), parse LRC, lalu tambahkan romanisasi.

import { romanizeLines } from "./romanize.js";

const API = "https://lrclib.net/api";
const cache = new Map();

const norm = (s) => (s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// "Handlebars (feat. Dua Lipa)" -> "Handlebars", "Damn Right - Just JENNIE" -> "Damn Right"
export const cleanTitle = (t) =>
  (t || "")
    .replace(/\s*[(\[][^)\]]*[)\]]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();

// "JENNIE, Dua Lipa" -> "JENNIE"
export const firstArtist = (a) =>
  (a || "").split(/\s*(?:,|;|&|\/|\bfeat\.?|\bft\.?)\s*/i)[0].trim();

// Parse LRC: dukung banyak timestamp per baris dan tag kata <mm:ss.xx>
export function parseLrc(text) {
  const out = [];
  for (const row of String(text || "").split("\n")) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const lyric = row
      .replace(/^(\s*\[\d+:\d+(?:\.\d+)?\])+/, "")
      .replace(/<\d+:\d+(?:\.\d+)?>/g, "")
      .trim();
    for (const m of stamps)
      out.push({ t: parseInt(m[1], 10) * 60 + parseFloat(m[2]), text: lyric });
  }
  return out.sort((a, b) => a.t - b.t);
}

// Indeks baris terakhir yang waktunya <= t (binary search); -1 kalau belum ada
export function findLine(lines, t) {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

// Pilih kandidat terbaik: utamakan yang ada timestamp, lalu durasi paling dekat
export function pickBest(list, duration) {
  const usable = list.filter((x) => x && (x.syncedLyrics || x.plainLyrics));
  if (!usable.length) return null;
  const score = (x) => {
    const d =
      duration > 0 && x.duration > 0 ? Math.abs(x.duration - duration) : 5;
    return (x.syncedLyrics ? 0 : 8) + d;
  };
  return [...usable].sort((a, b) => score(a) - score(b))[0];
}

async function getJson(url, ms = 4500) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function lookupLyrics({ title, artist, album, duration }) {
  const found = [];
  const best = () => pickBest(found, duration);
  const hasSynced = () => Boolean(best()?.syncedLyrics);

  // 1) Pencocokan persis (judul + artis + album + durasi)
  if (title && artist && album && duration > 0) {
    try {
      const q = new URLSearchParams({
        track_name: title,
        artist_name: artist,
        album_name: album,
        duration: String(Math.round(duration)),
      });
      const hit = await getJson(`${API}/get?${q}`);
      if (hit) found.push(hit);
    } catch {
      /* lanjut ke pencarian */
    }
    if (hasSynced()) return best();
  }

  // 2) Pencarian bertahap: judul asli, judul bersih, lalu pencarian bebas
  const ct = cleanTitle(title);
  const fa = firstArtist(artist);
  const attempts = [
    { track_name: title || "", artist_name: artist || "" },
    { track_name: ct, artist_name: fa },
    { q: [ct, fa].filter(Boolean).join(" ") },
  ];
  const seen = new Set();
  const plausible = (x) => {
    const a = norm(ct);
    const b = norm(cleanTitle(x.trackName));
    if (a && b && (a.includes(b) || b.includes(a))) return true;
    return (
      duration > 0 && x.duration > 0 && Math.abs(x.duration - duration) <= 3
    );
  };
  for (const params of attempts) {
    if (!Object.values(params).some(Boolean)) continue;
    const q = new URLSearchParams(params).toString();
    if (seen.has(q)) continue;
    seen.add(q);
    const list = await getJson(`${API}/search?${q}`);
    if (Array.isArray(list)) found.push(...list.filter(plausible));
    if (hasSynced()) break;
  }
  return best();
}

// Hasil: { synced: boolean, lines: [{ t, text, roma? }], duration } atau null
export async function loadLyrics(track) {
  const key =
    `${track.title}|${track.artist}|${Math.round(track.duration || 0)}`.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  try {
    const hit = await lookupLyrics(track);
    let result = null;
    if (hit?.syncedLyrics) {
      const lines = parseLrc(hit.syncedLyrics);
      if (lines.length)
        result = { synced: true, lines, duration: hit.duration || 0 };
    }
    if (!result && hit?.plainLyrics) {
      const lines = hit.plainLyrics
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) => ({ t: 0, text }));
      if (lines.length)
        result = { synced: false, lines, duration: hit.duration || 0 };
    }
    if (result)
      result = { ...result, lines: await romanizeLines(result.lines) };
    if (cache.size >= 80) cache.delete(cache.keys().next().value); // batasi memori
    cache.set(key, result);
    return result;
  } catch {
    return null; // gagal jaringan: jangan di-cache supaya bisa dicoba lagi
  }
}
