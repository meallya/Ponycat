import { useEffect, useMemo, useRef, useState } from "react";
import { IconMenuSearch } from "./icons.jsx";

const ROW_H = 34; // px, tinggi satu baris hasil
const VISIBLE_ROWS = 3; // area slide cuma 152px (SLIDE_H di layout.js), sisanya di-scroll
const MAX_RESULTS = 30;
const KIND_LABEL = { desktop: "Aplikasi", store: "Aplikasi Microsoft Store" };

// Skor kecocokan nama dengan kata kunci (makin tinggi makin atas).
function score(name, q) {
  const n = name.toLowerCase();
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  const words = n.split(/[\s\-_.()]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 60;
  if (
    q.length >= 2 &&
    words
      .map((w) => w[0])
      .join("")
      .startsWith(q)
  )
    return 50; // "vsc" -> Visual Studio Code
  const at = n.indexOf(q);
  if (at >= 0) return 40 - Math.min(at, 20) / 2;
  let qi = 0;
  for (const ch of n) if (ch === q[qi] && ++qi === q.length) return 10; // huruf berurutan
  return 0;
}

function hue(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function AppIcon({ app, icon }) {
  if (icon && icon.url) {
    return (
      <div
        className="srch-icon"
        style={icon.bg ? { background: icon.bg } : undefined}
      >
        <img src={icon.url} alt="" draggable={false} />
      </div>
    );
  }
  // Tidak ada logo yang bisa dibaca: avatar huruf sebagai cadangan
  return (
    <div
      className="srch-icon"
      style={{ background: `hsl(${hue(app.name)} 40% 36%)` }}
      aria-hidden="true"
    >
      {app.name.charAt(0).toUpperCase()}
    </div>
  );
}

const CSS = `
.srch { box-sizing: border-box; width: min(100%, 520px); margin: 0 auto; padding: 4px 16px 0; display: flex; flex-direction: column; gap: 6px; color: #fff; font-size: 13px; }
.srch-field { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 12px; background: rgba(255,255,255,.09); cursor: text; }
.srch-field:focus-within { background: rgba(255,255,255,.14); }
.srch-field svg { flex: none; opacity: .6; }
.srch-field input { flex: 1; min-width: 0; background: transparent; border: 0; outline: 0; color: inherit; font: inherit; font-size: 14px; }
.srch-field input::placeholder { color: rgba(255,255,255,.4); }
.srch-list { overflow-y: auto; display: flex; flex-direction: column; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.25) transparent; }
.srch-row { flex: none; display: flex; align-items: center; gap: 10px; padding: 0 8px; border-radius: 10px; cursor: pointer; }
.srch-row.on { background: rgba(255,255,255,.14); }
.srch-icon { flex: none; width: 24px; height: 24px; border-radius: 6px; overflow: hidden; display: grid; place-items: center; font-weight: 600; font-size: 12px; }
.srch-icon img { display: block; width: 100%; height: 100%; object-fit: contain; }
.srch-meta { min-width: 0; line-height: 1.2; }
.srch-name { font-size: 12.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.srch-sub { font-size: 10.5px; color: rgba(255,255,255,.5); }
.srch-empty { padding: 14px 0; text-align: center; color: rgba(255,255,255,.45); }
.srch-error { flex: none; font-size: 11px; color: #ff6b63; }
`;

export default function SearchSlide({ onFocusChange, onDone, focusSignal }) {
  const [apps, setApps] = useState(null); // null = masih memuat
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [icons, setIcons] = useState({});
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const asked = useRef(new Set()); // id yang ikonnya sudah diminta

  // Daftar aplikasi dimuat sekali saat slide dibuat
  useEffect(() => {
    let alive = true;
    const api = window.island?.apps;
    if (!api) {
      setApps([]);
      return;
    }
    api
      .list()
      .then((l) => alive && setApps(l))
      .catch(() => alive && setApps([]));
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !apps) return [];
    return apps
      .map((a) => ({ a, s: score(a.name, q) }))
      .filter((x) => x.s > 0)
      .sort(
        (x, y) =>
          y.s - x.s ||
          x.a.name.length - y.a.name.length ||
          x.a.name.localeCompare(y.a.name),
      )
      .slice(0, MAX_RESULTS)
      .map((x) => x.a);
  }, [apps, query]);

  // Minta ikon hanya untuk hasil yang tampil
  useEffect(() => {
    const api = window.island?.apps;
    if (!api) return;
    for (const a of results) {
      if (asked.current.has(a.id)) continue;
      asked.current.add(a.id);
      api
        .icon(a.id)
        .then((icon) => icon && setIcons((prev) => ({ ...prev, [a.id]: icon })))
        .catch(() => {});
    }
  }, [results]);

  // Jaga baris terpilih tetap terlihat. Dihitung manual (bukan scrollIntoView)
  // supaya carousel/pill di atasnya tidak ikut bergeser.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const top = sel * ROW_H;
    const bottom = top + ROW_H;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [sel, results]);

  // Window island tidak bisa fokus secara default (lihat main.js), jadi harus dibuat
  // focusable dulu. Pakai ref, bukan e.currentTarget (null setelah await).
  // preventScroll: semua slide ter-mount sekaligus, tanpa ini fokus bisa menggeser viewport.
  const grabKeyboard = async () => {
    await window.island?.setFocusable(true);
    inputRef.current?.focus({ preventScroll: true });
    onFocusChange?.(true);
    window.island?.apps
      ?.list()
      .then(setApps)
      .catch(() => {}); // ambil daftar terbaru
  };

  // Pintasan global: Island menaikkan focusSignal. Tidak ada fokus otomatis saat mount.
  useEffect(() => {
    if (focusSignal) grabKeyboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  const onFieldMouseDown = (e) => {
    const input = inputRef.current;
    if (!input) return;
    if (document.activeElement === input) {
      if (e.target !== input) e.preventDefault(); // klik di ikon: input jangan kehilangan fokus
      return;
    }
    e.preventDefault();
    grabKeyboard();
  };

  const launch = async (a) => {
    if (!a) return;
    const ok = await window.island?.apps?.launch(a.id);
    if (ok === false) {
      setError(`Gagal membuka ${a.name}`);
      return;
    }
    setQuery("");
    setSel(0);
    inputRef.current?.blur(); // lepas fokus supaya aplikasi yang dibuka langsung aktif
    onDone?.();
  };

  const onKeyDown = (e) => {
    e.stopPropagation(); // jangan sampai carousel menangkap tombol panah
    const n = results.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((i) => (n ? (i + 1) % n : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((i) => (n ? (i - 1 + n) % n : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      launch(results[sel]);
    } else if (e.key === "Escape") {
      if (query) {
        setQuery("");
        setSel(0);
      } else {
        inputRef.current?.blur();
        onDone?.();
      }
    }
  };

  const q = query.trim();
  const emptyText =
    apps === null
      ? "Memuat daftar aplikasi…"
      : apps.length === 0
        ? "Tidak ada aplikasi ditemukan"
        : q
          ? `Tidak ada hasil untuk “${q}”`
          : "Ketik nama aplikasi untuk membukanya";

  return (
    <div className="srch">
      <style>{CSS}</style>

      <div className="srch-field" onMouseDown={onFieldMouseDown}>
        <IconMenuSearch size={15} />
        <input
          ref={inputRef}
          value={query}
          placeholder="Cari aplikasi…"
          aria-label="Cari aplikasi"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0);
            setError("");
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            window.island?.setFocusable(false);
            onFocusChange?.(false);
          }}
        />
        {error && (
          <span className="srch-error" role="alert">
            {error}
          </span>
        )}
      </div>

      {results.length > 0 ? (
        <div
          className="srch-list"
          ref={listRef}
          role="listbox"
          style={{ maxHeight: ROW_H * VISIBLE_ROWS }}
        >
          {results.map((a, i) => (
            <div
              key={a.id}
              role="option"
              aria-selected={i === sel}
              className={`srch-row ${i === sel ? "on" : ""}`}
              style={{ height: ROW_H }}
              onMouseDown={(e) => e.preventDefault()} // klik baris tidak melepas fokus input
              onMouseMove={() => sel !== i && setSel(i)}
              onClick={() => launch(a)}
            >
              <AppIcon app={a} icon={icons[a.id]} />
              <div className="srch-meta">
                <div className="srch-name">{a.name}</div>
                <div className="srch-sub">
                  {KIND_LABEL[a.kind] || "Aplikasi"}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="srch-empty">{emptyText}</div>
      )}
    </div>
  );
}
