// Cover album: pencarian cadangan lewat internet + pengambilan warna dominan.

const artCache = new Map();
const ART_CACHE_MAX = 60;

function remember(map, max, key, value) {
  if (map.size >= max) map.delete(map.keys().next().value); // buang yang paling lama
  map.set(key, value);
}

// Fallback cover album: iTunes Search API (gratis, tanpa API key).
// Dipakai kalau media.thumbnail dari Windows kosong / gagal dimuat.
export async function fetchAlbumArt(title, artist, album) {
  const key = `${title}|${artist}|${album}`.toLowerCase();
  if (artCache.has(key)) return artCache.get(key);
  try {
    const q = new URLSearchParams({
      term: [title, artist].filter(Boolean).join(" "),
      media: "music",
      entity: "song",
      limit: "10",
    });
    const res = await fetch(`https://itunes.apple.com/search?${q}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error("fail");
    const { results = [] } = await res.json();

    const norm = (s) => (s || "").toLowerCase();
    const mainArtist = norm(artist)
      .split(/,|&|feat\.?/)[0]
      .trim();
    const sameArtist = results.filter(
      (r) => !mainArtist || norm(r.artistName).includes(mainArtist),
    );
    const pool = sameArtist.length ? sameArtist : results;
    const hit =
      pool.find((r) => album && norm(r.collectionName).includes(norm(album))) ||
      pool[0];

    // artworkUrl100 -> versi 600x600
    const url =
      hit?.artworkUrl100?.replace(/\/\d+x\d+bb\./, "/600x600bb.") || null;
    remember(artCache, ART_CACHE_MAX, key, url);
    return url;
  } catch {
    return null; // gagal jaringan: jangan di-cache, boleh dicoba lagi
  }
}

// ---------- Warna dominan ----------

const tintCache = new Map();
const TINT_CACHE_MAX = 40;

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const hsl = (h, s, l) =>
  `hsl(${Math.round(h)} ${Math.round(clamp01(s) * 100)}% ${Math.round(clamp01(l) * 100)}%)`;

// Luminansi relatif (WCAG) dari nilai hsl, untuk memeriksa kontras teks.
function luminance(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const lin = (v) => {
    v += m;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (l1, l2) => {
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
};

// Dari piksel gambar → warna latar notch (gelap, kaya warna) dan warna teks lirik.
function paletteFromPixels(data) {
  const BUCKETS = 12;
  const acc = Array.from({ length: BUCKETS }, () => ({ w: 0, s: 0, l: 0, n: 0, hx: 0, hy: 0 }));
  let gray = 0;
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    total += 1;
    gray += l;
    // Abaikan hampir hitam, hampir putih, dan abu-abu: bukan "warna" cover
    if (l < 0.1 || l > 0.92 || s < 0.15) continue;
    // Piksel jenuh dan bernada menengah paling mewakili cover
    const weight = s * (1 - Math.abs(2 * l - 1)) + 0.02;
    const b = acc[Math.floor((h / 360) * BUCKETS) % BUCKETS];
    b.w += weight;
    b.s += s * weight;
    b.l += l * weight;
    b.n += 1;
    const rad = (h * Math.PI) / 180;
    b.hx += Math.cos(rad) * weight;
    b.hy += Math.sin(rad) * weight;
  }

  let best = null;
  acc.forEach((b, i) => {
    if (!best || b.w > best.w) best = { ...b, i };
  });

  if (!best || best.w < total * 0.01) {
    // Cover hampir hitam-putih: pakai abu-abu hangat sesuai kecerahan rata-rata
    const l = total ? gray / total : 0.2;
    return buildPalette(0, 0, clamp01(l));
  }
  // Hue = rata-rata melingkar piksel di ember terpilih (bukan pusat ember), supaya merah tetap merah
  const h = ((Math.atan2(best.hy, best.hx) * 180) / Math.PI + 360) % 360;
  return buildPalette(h, best.s / best.w, best.l / best.w);
}

function buildPalette(h, s, l) {
  // Latar notch: dibuat gelap supaya tetap terasa seperti notch, tapi jelas berwarna cover
  const sat = s < 0.08 ? 0 : Math.min(0.78, Math.max(0.35, s));
  const mid = Math.min(0.27, Math.max(0.15, l * 0.55));
  const edge = Math.max(0.07, mid * 0.45);

  // Teks lirik: putih dengan sedikit rona cover, dipaksa kontras tinggi
  const bgLum = luminance(h, sat, mid);
  let fgLight = 0.96;
  let fg = hsl(h, sat > 0 ? 0.5 : 0, fgLight);
  if (contrast(luminance(h, sat > 0 ? 0.5 : 0, fgLight), bgLum) < 7) {
    fg = "#ffffff";
  }

  return {
    a: hsl(h, sat, mid), // warna tengah
    b: hsl(h, sat * 0.9, edge), // warna tepi
    fg,
  };
}

// Ambil warna dari gambar (URL). Hasil: { a, b, fg } atau null kalau gagal dimuat/dibaca.
export function extractTint(url) {
  if (!url) return Promise.resolve(null);
  if (tintCache.has(url)) return Promise.resolve(tintCache.get(url));

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const done = (value) => {
      if (value) remember(tintCache, TINT_CACHE_MAX, url, value);
      img.onload = img.onerror = null;
      resolve(value);
    };
    img.onload = () => {
      try {
        const S = 24;
        const canvas = document.createElement("canvas");
        canvas.width = S;
        canvas.height = S;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, S, S);
        done(paletteFromPixels(ctx.getImageData(0, 0, S, S).data));
      } catch {
        done(null); // canvas tidak boleh dibaca → tetap hitam
      }
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}
