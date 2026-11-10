import { useCallback, useEffect, useRef, useState } from "react";
import Island from "./components/Island.jsx";
import { useMedia } from "./hooks/useMedia.js";
import { useLyrics } from "./hooks/useLyrics.js";
import { useTimer } from "./hooks/useTimer.js";
import { useAlbumTint } from "./hooks/useAlbumTint.js";
import { beep } from "./lib/beep.js";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "./lib/layout.js";

const AUTO_HIDE = 4000;
const COLLAPSE = 2500;
const POPUP = 4000;
const DWELL = 150;

// Di Electron, posisi kursor (hover notch + zona atas) datang dari main process.
// Event mouse DOM hanya dipakai kalau halaman dibuka di browser biasa.
const NATIVE_CURSOR = Boolean(
  typeof window !== "undefined" && window.island?.onCursor,
);

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [slideId, setSlideId] = useState("music");
  const [hovered, setHovered] = useState(false);
  const [zone, setZone] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [popup, setPopup] = useState(false);
  const [tempItems, setTempItems] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [notifMeta, setNotifMeta] = useState({ ok: false, error: null });
  const [todos, setTodos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [settings, setSettings] = useState(() => loadSettings());

  const dwell = useRef(null);
  const leaveTimer = useRef(null);
  const saveTimer = useRef(null);
  const live = useRef({});
  live.current = { hovered, pinned, notes, expanded };

  const { media, command } = useMedia();
  const lyrics = useLyrics(media);
  // Warna notch mengikuti cover album: di notch tertutup saat lirik tampil, dan di slide Musik.
  // Hasilnya di-cache per cover, jadi aman dihitung selama ada lagu.
  const tint = useAlbumTint(media, Boolean(media?.hasSession && media.title));

  const attention = useCallback((id) => {
    if (live.current.hovered || live.current.pinned) return;
    setSlideId(id);
    setExpanded(true);
    setHidden(false);
    setPopup(true);
  }, []);

  const timer = useTimer(
    useCallback(() => {
      beep();
      attention("timer");
    }, [attention]),
  );

  // Bentuk notch saat tertutup: lirik (kalau lagu punya lirik ber-timestamp) > musik > timer > idle
  const compactKind =
    media?.hasSession && media.status === "playing"
      ? lyrics?.synced
        ? "lyric"
        : "music"
      : timer.running
        ? "timer"
        : "idle";

  /* Musik auto-open */
  const seen = useRef({ key: null, status: null });
  useEffect(() => {
    if (!media?.hasSession) {
      seen.current = { key: null, status: null };
      return;
    }
    const key = `${media.app}|${media.title}|${media.artist}`;
    const prev = seen.current;
    seen.current = { key, status: media.status };
    if (
      media.status === "playing" &&
      (prev.status !== "playing" || prev.key !== key)
    ) {
      attention("music");
    }
  }, [media, attention]);

  /* Tray reveal */
  useEffect(() => {
    return window.island?.onReveal?.(() => {
      setHidden(false);
      setExpanded(true);
      setPopup(true);
    });
  }, []);

  /* Auto collapse expanded */
  useEffect(() => {
    if (!expanded || hovered || pinned) return;
    const t = setTimeout(
      () => {
        setExpanded(false);
        setPopup(false);
      },
      popup ? POPUP : COLLAPSE,
    );
    return () => clearTimeout(t);
  }, [expanded, hovered, pinned, popup]);

  /* Auto hide compact */
  useEffect(() => {
    if (expanded || hovered || zone || pinned || hidden) return;
    const t = setTimeout(() => setHidden(true), AUTO_HIDE);
    return () => clearTimeout(t);
  }, [expanded, hovered, zone, pinned, hidden]);

  /* Mouse ignore (hanya fallback di browser; di Electron diatur main process) */
  useEffect(() => {
    if (NATIVE_CURSOR) return;
    if (hidden) {
      window.island?.setIgnoreMouse(true);
      return;
    }
    if (expanded || zone) {
      window.island?.setIgnoreMouse(false);
      return;
    }
    window.island?.setIgnoreMouse(!hovered);
  }, [expanded, hidden, hovered, zone]);

  const onHover = useCallback((v) => {
    setHovered(v);
    if (v) {
      setPopup(false);
      clearTimeout(leaveTimer.current);
    }
  }, []);

  // Kursor ke area atas → tampilkan + buka notch
  const onZoneEnter = () => {
    clearTimeout(dwell.current);
    clearTimeout(leaveTimer.current);
    dwell.current = setTimeout(() => {
      setHidden(false);
      setZone(true);
      setExpanded(true);
      setPopup(false);
    }, DWELL);
  };

  const onZoneLeave = () => {
    clearTimeout(dwell.current);
    setZone(false);
  };

  // Kursor keluar / ke bawah dari island → tutup (kecuali pinned)
  const onIslandHover = useCallback(
    (v) => {
      onHover(v);
      if (v) {
        setHidden(false);
        clearTimeout(leaveTimer.current);
        return;
      }
      // mouse leave island
      if (pinned) return;
      leaveTimer.current = setTimeout(() => {
        setExpanded(false);
        setPopup(false);
      }, 400);
    },
    [onHover, pinned],
  );

  /* Posisi kursor dari main process (hover notch + zona atas layar) */
  const cursorFns = useRef({});
  cursorFns.current = { onIslandHover, onZoneEnter, onZoneLeave };
  useEffect(() => {
    if (!NATIVE_CURSOR) return;
    const prev = { hover: false, zone: false };
    return window.island.onCursor(({ hover, zone }) => {
      const f = cursorFns.current;
      if (zone !== prev.zone) {
        prev.zone = zone;
        if (zone) f.onZoneEnter();
        else f.onZoneLeave();
      }
      if (hover !== prev.hover) {
        prev.hover = hover;
        f.onIslandHover(hover);
      }
    });
  }, []);

  /* Settings */
  const onSettings = useCallback((next) => {
    setSettings(next);
    saveSettings(next);
    // apply accent to document for eq etc
    document.documentElement.style.setProperty("--accent", next.accent);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accent);
  }, [settings.accent]);

  /* Todos (persist) */
  useEffect(() => {
    Promise.resolve(window.island?.todos?.load?.()).then((raw) => {
      try {
        const list = typeof raw === "string" ? JSON.parse(raw || "[]") : [];
        if (Array.isArray(list)) setTodos(list);
      } catch {
        setTodos([]);
      }
    });
  }, []);

  /* Notifikasi Windows (real) */
  useEffect(() => {
    let off = () => {};
    window.island?.notifs?.get?.().then((data) => {
      if (!data) return;
      setNotifMeta({
        ok: !!data.ok,
        error: data.error || null,
        message: data.message,
      });
      if (Array.isArray(data.items)) setNotifs(data.items);
    });
    off =
      window.island?.notifs?.onUpdate?.((data) => {
        if (!data) return;
        setNotifMeta({
          ok: !!data.ok,
          error: data.error || null,
          message: data.message,
        });
        if (Array.isArray(data.items)) setNotifs(data.items);
      }) || (() => {});
    return () => off();
  }, []);

  /* Notes */
  useEffect(() => {
    Promise.resolve(window.island?.notes?.load?.()).then((raw) => {
      try {
        const parsed =
          typeof raw === "string"
            ? JSON.parse(raw || "[]")
            : Array.isArray(raw)
              ? raw
              : [];
        if (Array.isArray(parsed) && parsed.length) {
          setNotes(parsed);
          setActiveNoteId(parsed[0].id);
          return;
        }
      } catch {
        if (typeof raw === "string" && raw.trim()) {
          const n = { id: uid(), text: raw, updatedAt: Date.now() };
          setNotes([n]);
          setActiveNoteId(n.id);
          return;
        }
      }
      const n = { id: uid(), text: "", updatedAt: Date.now() };
      setNotes([n]);
      setActiveNoteId(n.id);
    });
  }, []);

  const persistNotes = useCallback((list) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.island?.notes?.save(JSON.stringify(list));
    }, 400);
  }, []);

  const onNoteChange = useCallback(
    (id, text) => {
      setNotes((list) => {
        const next = list.map((n) =>
          n.id === id ? { ...n, text, updatedAt: Date.now() } : n,
        );
        persistNotes(next);
        return next;
      });
    },
    [persistNotes],
  );

  const onNoteNew = useCallback(() => {
    const n = { id: uid(), text: "", updatedAt: Date.now() };
    setNotes((list) => {
      const next = [n, ...list];
      persistNotes(next);
      return next;
    });
    setActiveNoteId(n.id);
  }, [persistNotes]);

  const onNoteDelete = useCallback(
    (id) => {
      setNotes((list) => {
        const next = list.filter((n) => n.id !== id);
        if (next.length === 0) {
          const n = { id: uid(), text: "", updatedAt: Date.now() };
          persistNotes([n]);
          setActiveNoteId(n.id);
          return [n];
        }
        persistNotes(next);
        setActiveNoteId((cur) => (cur === id ? next[0].id : cur));
        return next;
      });
    },
    [persistNotes],
  );

  const onNotesFocus = useCallback((focused) => {
    setPinned(focused);
    if (!focused) {
      clearTimeout(saveTimer.current);
      window.island?.notes?.save(JSON.stringify(live.current.notes));
    }
  }, []);

  const onTempAdd = useCallback((items) => {
    setTempItems((list) => [...items, ...list].slice(0, 20));
  }, []);
  const onTempRemove = useCallback(
    (id) => setTempItems((list) => list.filter((x) => x.id !== id)),
    [],
  );
  const onTempClear = useCallback(() => setTempItems([]), []);

  const onNotifDismiss = useCallback((id) => {
    window.island?.notifs?.command?.(`dismiss ${id}`);
    setNotifs((list) => list.filter((n) => n.id !== id));
  }, []);
  const onNotifClear = useCallback(() => {
    window.island?.notifs?.command?.("clear");
    setNotifs([]);
  }, []);
  const persistTodos = useCallback((list) => {
    window.island?.todos?.save?.(JSON.stringify(list));
  }, []);
  const onTodoAdd = useCallback(
    (text) => {
      setTodos((list) => {
        const next = [{ id: Date.now(), text, done: false }, ...list].slice(
          0,
          40,
        );
        persistTodos(next);
        return next;
      });
    },
    [persistTodos],
  );
  const onTodoToggle = useCallback(
    (id) => {
      setTodos((list) => {
        const next = list.map((t) =>
          t.id === id ? { ...t, done: !t.done } : t,
        );
        persistTodos(next);
        return next;
      });
    },
    [persistTodos],
  );
  const onTodoRemove = useCallback(
    (id) => {
      setTodos((list) => {
        const next = list.filter((t) => t.id !== id);
        persistTodos(next);
        return next;
      });
    },
    [persistTodos],
  );

  const onStageClick = () => {
    if (expanded && !pinned) {
      setExpanded(false);
      setPopup(false);
    }
  };

  return (
    <div className="stage" onClick={onStageClick}>
      <div
        className={`open-hint ${hidden && !zone ? "show" : ""}`}
        onMouseEnter={NATIVE_CURSOR ? undefined : onZoneEnter}
        onMouseMove={NATIVE_CURSOR ? undefined : onZoneEnter}
        onMouseLeave={NATIVE_CURSOR ? undefined : onZoneLeave}
        title="Arahkan kursor ke sini untuk membuka"
      />
      {/* Zona atas lebih lebar: kursor ke atas → buka */}
      <div
        className="hotzone"
        onMouseEnter={NATIVE_CURSOR ? undefined : onZoneEnter}
        onMouseMove={NATIVE_CURSOR ? undefined : onZoneEnter}
        onMouseLeave={NATIVE_CURSOR ? undefined : onZoneLeave}
      />
      <Island
        expanded={expanded}
        hidden={hidden}
        slideId={slideId}
        onSlideId={setSlideId}
        compactKind={compactKind}
        tint={tint}
        nativeCursor={NATIVE_CURSOR}
        media={media}
        lyrics={lyrics}
        command={command}
        timer={timer}
        tempItems={tempItems}
        onTempAdd={onTempAdd}
        onTempRemove={onTempRemove}
        onTempClear={onTempClear}
        notes={notes}
        activeNoteId={activeNoteId}
        onNoteSelect={setActiveNoteId}
        onNoteChange={onNoteChange}
        onNoteNew={onNoteNew}
        onNoteDelete={onNoteDelete}
        onNotesFocus={onNotesFocus}
        notifs={notifs}
        notifMeta={notifMeta}
        onNotifDismiss={onNotifDismiss}
        onNotifClear={onNotifClear}
        todos={todos}
        onTodoAdd={onTodoAdd}
        onTodoToggle={onTodoToggle}
        onTodoRemove={onTodoRemove}
        settings={settings}
        onSettings={onSettings}
        onHover={onIslandHover}
        onExpand={() => {
          setExpanded(true);
          setHidden(false);
          setPopup(false);
        }}
        onCollapse={() => {
          setExpanded(false);
          setPopup(false);
        }}
      />
    </div>
  );
}
