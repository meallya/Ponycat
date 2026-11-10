// Romanisasi lirik: tampilkan pelafalan huruf Latin di bawah lirik berbahasa asing.
// Semua offline, library dimuat lazy (baru di-load saat ada lirik yang butuh).
//
// Didukung : Korea (Hangul), Mandarin (pinyin), Jepang (khusus lirik kana saja),
//            Rusia/Cyrillic, Yunani.
// Belum    : Jepang dengan kanji (butuh kamus besar), Thai, Arab, Ibrani, Hindi.
//
// Dependency: npm i @romanize/korean pinyin-pro wanakana transliteration

const RE = {
  hangul: /[ᄀ-ᇿ㄰-㆏가-힯]/,
  kana: /[぀-ヿㇰ-ㇿｦ-ﾟ]/,
  han: /[㐀-䶿一-鿿]/,
  cyrillic: /[Ѐ-ӿ]/,
  greek: /[Ͱ-Ͽ]/,
};

// ---------------------------------------------------------------------------
// Korea: library hanya menulis ulang huruf per suku kata, jadi beberapa aturan
// pelafalan yang sering muncul di lirik kita terapkan dulu di level Hangul:
//   좋아 -> 조아 (joa), 같이 -> 가치 (gachi), 많다 -> 만타 (manta), 좋고 -> 조코 (joko)
// ---------------------------------------------------------------------------
const H_FIRST = 0xac00;
const H_LAST = 0xd7a3;

// indeks jamo awal (choseong): ㄱ0 ㄲ1 ㄴ2 ㄷ3 ㄸ4 ㄹ5 ㅁ6 ㅂ7 ㅃ8 ㅅ9 ㅆ10 ㅇ11 ㅈ12 ㅉ13 ㅊ14 ㅋ15 ㅌ16 ㅍ17 ㅎ18
// indeks batchim (jongseong): ㄱ1 ㄴ4 ㄶ6 ㄷ7 ㅀ15 ㅂ17 ㅈ22 ㅌ25 ㅎ27 ; vokal ㅣ = 20
function prepKorean(str) {
  const chars = [...str];
  const syl = chars.map((ch) => {
    const c = ch.codePointAt(0);
    if (c < H_FIRST || c > H_LAST) return null;
    const o = c - H_FIRST;
    return { i: Math.floor(o / 588), m: Math.floor((o % 588) / 28), f: o % 28 };
  });

  for (let k = 0; k < syl.length - 1; k++) {
    const a = syl[k];
    const b = syl[k + 1];
    if (!a || !b) continue;

    if (b.i === 11) {
      // suku kata berikut diawali ㅇ (bunyi vokal langsung)
      if (a.f === 27)
        a.f = 0; // ㅎ lenyap: 좋아 -> 조아
      else if (a.f === 6)
        a.f = 4; // ㄶ -> ㄴ: 않아 -> 안아
      else if (a.f === 15)
        a.f = 8; // ㅀ -> ㄹ
      else if (a.f === 25 && b.m === 20) {
        // ㅌ + 이 -> 치: 같이 -> 가치
        a.f = 0;
        b.i = 14;
      }
    } else if (a.f === 27 || a.f === 6 || a.f === 15) {
      // ㅎ / ㄶ / ㅀ + ㄱ ㄷ ㅈ -> ㅋ ㅌ ㅊ: 좋고 -> 조코, 많다 -> 만타
      const asp = { 0: 15, 3: 16, 12: 14 }[b.i];
      if (asp !== undefined) {
        a.f = a.f === 6 ? 4 : a.f === 15 ? 8 : 0;
        b.i = asp;
      }
    } else if (b.i === 18) {
      // ㄱ ㄷ ㅂ ㅈ + ㅎ -> ㅋ ㅌ ㅍ ㅊ: 착하다 -> 차카다
      const asp = { 1: 15, 7: 16, 17: 17, 22: 14 }[a.f];
      if (asp !== undefined) {
        a.f = 0;
        b.i = asp;
      }
    }
  }

  return chars
    .map((ch, k) =>
      syl[k]
        ? String.fromCodePoint(
            H_FIRST + syl[k].i * 588 + syl[k].m * 28 + syl[k].f,
          )
        : ch,
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Loader lazy per bahasa + cara menjalankannya
// ---------------------------------------------------------------------------
const loaded = {};
const once = (name, fn) => (loaded[name] ??= fn());

const LOADERS = {
  ko: () =>
    once("ko", () =>
      import("@romanize/korean").then((m) => (m.default ?? m).romanize),
    ),
  zh: () => once("zh", () => import("pinyin-pro").then((m) => m.pinyin)),
  ja: () => once("ja", () => import("wanakana").then((m) => m.toRomaji)),
  tr: () =>
    once("tr", () => import("transliteration").then((m) => m.transliterate)),
};

const RUN = {
  ko: (fn, t) => fn(prepKorean(t)),
  zh: (fn, t) =>
    fn(t, {
      type: "string",
      toneType: "symbol",
      nonZh: "consecutive",
      v: true,
    }),
  ja: (fn, t) => fn(t),
  tr: (fn, t) => fn(t),
};

const tidy = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// API utama: terima [{ t, text }], kembalikan array yang sama + field `roma`
// (hanya pada baris yang memang perlu). Tidak pernah throw.
// ---------------------------------------------------------------------------
export async function romanizeLines(lines) {
  try {
    const joined = lines.map((l) => l.text || "").join("\n");
    const songKana = RE.kana.test(joined);
    const songHan = RE.han.test(joined);
    // Lagu Jepang yang berisi kanji: pembacaan kanji butuh kamus, jadi dilewati
    // seluruhnya supaya tampilannya konsisten (bukan sebagian baris saja).
    const jaUnsupported = songKana && songHan;

    const engineFor = (text) => {
      if (!text) return null;
      if (RE.hangul.test(text)) return "ko";
      if (RE.kana.test(text) || RE.han.test(text)) {
        if (songKana) return jaUnsupported ? null : "ja";
        return RE.han.test(text) ? "zh" : null;
      }
      if (RE.cyrillic.test(text) || RE.greek.test(text)) return "tr";
      return null;
    };

    const engines = lines.map((l) => engineFor(l.text));
    const needed = [...new Set(engines.filter(Boolean))];
    if (!needed.length) return lines;

    const fns = {};
    await Promise.all(
      needed.map(async (e) => {
        fns[e] = await LOADERS[e]().catch(() => null);
      }),
    );

    return lines.map((l, i) => {
      const e = engines[i];
      if (!e || !fns[e]) return l;
      let roma = "";
      try {
        roma = tidy(RUN[e](fns[e], l.text));
      } catch {
        roma = "";
      }
      if (!roma || roma.toLowerCase() === l.text.trim().toLowerCase()) return l;
      return { ...l, roma };
    });
  } catch {
    return lines;
  }
}

export { prepKorean as _prepKorean };
