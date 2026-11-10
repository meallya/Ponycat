import { useEffect, useState } from "react";
import { extractTint, fetchAlbumArt } from "../lib/albumArt.js";

// Warna notch dari cover album yang sedang diputar.
// Hasil: { a, b, fg } (warna tengah, warna tepi, warna teks) atau null.
// `enabled` = false (mis. lirik tidak sedang tampil) → tidak ada pekerjaan sama sekali.
// Warna lama dipertahankan saat lagu baru masih dihitung, supaya transisinya halus.
export function useAlbumTint(media, enabled) {
  const [tint, setTint] = useState(null);

  const hasSession = Boolean(media?.hasSession);
  const title = media?.title || "";
  const artist = media?.artist || "";
  const album = media?.album || "";
  const thumb = media?.thumbnail || "";

  useEffect(() => {
    if (!enabled || !hasSession || !title) {
      setTint(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // 1) cover dari Windows; 2) kalau kosong / tidak terbaca, cover dari internet
      let result = thumb ? await extractTint(thumb) : null;
      if (!result && !cancelled) {
        const web = await fetchAlbumArt(title, artist, album);
        if (web && !cancelled) result = await extractTint(web);
      }
      if (!cancelled) setTint(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, hasSession, title, artist, album, thumb]);

  return enabled ? tint : null;
}
