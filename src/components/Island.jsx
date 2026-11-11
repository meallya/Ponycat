import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  animate,
  useMotionValue,
} from "framer-motion";
import Compact from "./Compact.jsx";
import MenuItem from "./MenuItem.jsx";
import MusicSlide from "./MusicSlide.jsx";
import TimerSlide from "./TimerSlide.jsx";
import TempSlide from "./TempSlide.jsx";
import NotesSlide from "./NotesSlide.jsx";
import PrayerSlide from "./PrayerSlide.jsx";
import NotifAppsSlide from "./NotifAppsSlide.jsx";
import ListSlide from "./ListSlide.jsx";
import ClockSlide from "./ClockSlide.jsx";
import SearchSlide from "./SearchSlide.jsx";
import ConvertSlide from "./ConvertSlide.jsx";
import { IconMenuConvert } from "./ConvertIcon.jsx";
import {
  IconMenuMusic,
  IconMenuTimer,
  IconMenuTemp,
  IconMenuNotes,
  IconMenuMail,
  IconMenuList,
  IconMenuCalendar,
  IconMenuPrayer,
  IconMenuSearch,
} from "./icons.jsx";
import {
  ALL_SLIDES,
  BASE_EXPANDED,
  BASE_COMPACT,
  BASE_COMPACT_LYRIC,
  SLIDE_H,
} from "../lib/layout.js";

const SIZE_T = { duration: 0.36, ease: [0.22, 1, 0.36, 1] };
const VERTICAL = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };
const SLIDE_SNAP = { type: "spring", stiffness: 380, damping: 36, mass: 0.75 };
const HIDDEN_Y = -40;

const ICON_MAP = {
  music: IconMenuMusic,
  timer: IconMenuTimer,
  notif: IconMenuMail,
  list: IconMenuList,
  notes: IconMenuNotes,
  clock: IconMenuCalendar,
  prayer: IconMenuPrayer,
  temp: IconMenuTemp,
  search: IconMenuSearch,
  convert: IconMenuConvert,
};

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
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
const pad = (n) => String(n).padStart(2, "0");

function MenuClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <button type="button" className="menu-clock" title="Waktu">
      {DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]} ·{" "}
      {pad(now.getHours())}:{pad(now.getMinutes())}
    </button>
  );
}

export default function Island({
  expanded,
  hidden,
  slideId,
  onSlideId,
  compactKind,
  tint,
  nativeCursor,
  media,
  lyrics,
  adPlaying,
  switching,
  command,
  timer,
  tempItems,
  onTempAdd,
  onTempRemove,
  onTempClear,
  notes,
  activeNoteId,
  onNoteSelect,
  onNoteChange,
  onNoteNew,
  onNoteDate,
  onOpenDate,
  onNoteDelete,
  onNotesFocus,
  notifs,
  notifMeta,
  onNotifDismiss,
  onNotifClear,
  todos,
  onTodoAdd,
  onTodoToggle,
  onTodoRemove,
  settings,
  onSettings,
  onHover,
  onExpand,
  onCollapse,
}) {
  const scale = settings.scale || 1;
  // Saat lirik tampil di notch tertutup, pill-nya melebar supaya satu baris lirik muat
  const compactBase =
    compactKind === "lyric" ? BASE_COMPACT_LYRIC : BASE_COMPACT;
  const compact = {
    w: Math.round(compactBase.w * scale),
    h: Math.round(compactBase.h * scale),
  };
  const expandedSize = {
    w: Math.round(BASE_EXPANDED.w * scale),
    h: Math.round(BASE_EXPANDED.h * scale),
  };
  const size = expanded ? expandedSize : compact;
  const slideH = Math.round(SLIDE_H * scale);

  // Laporkan ukuran notch yang dituju ke main process: dipakai untuk hit-test kursor,
  // supaya klik di luar notch selalu tembus ke aplikasi lain.
  useEffect(() => {
    window.island?.setBounds?.({
      w: size.w,
      h: size.h,
      y: hidden ? HIDDEN_Y : 0,
      hidden,
    });
  }, [size.w, size.h, hidden]);

  // Isi panel yang sedang tertutup tidak perlu di-layout atau digambar sama sekali.
  // Dibiarkan hidup sebentar setelah menutup supaya animasi tutupnya tetap mulus.
  const [showContent, setShowContent] = useState(expanded);
  useEffect(() => {
    if (expanded) {
      setShowContent(true);
      return;
    }
    const t = setTimeout(() => setShowContent(false), 260);
    return () => clearTimeout(t);
  }, [expanded]);

  // Warna cover untuk notch tertutup saat lirik tampil. Warna terakhir disimpan
  // supaya saat memudar kembali ke hitam, warnanya tidak langsung lenyap.
  const lastTint = useRef(null);
  if (tint) lastTint.current = tint;
  const tintVars = lastTint.current
    ? { "--tint-a": lastTint.current.a, "--tint-b": lastTint.current.b }
    : undefined;

  const menus = useMemo(() => {
    return ALL_SLIDES.filter((s) => settings.menus.includes(s.id));
  }, [settings.menus]);

  const activeId = menus.some((m) => m.id === slideId)
    ? slideId
    : menus[0]?.id || "music";
  const slideIndex = Math.max(
    0,
    menus.findIndex((m) => m.id === activeId),
  );

  // Warna cover dipakai di dua tempat: notch tertutup saat lirik tampil, dan slide Musik
  const tintOn =
    Boolean(tint) &&
    (expanded ? activeId === "music" : compactKind === "lyric");

  const w = expandedSize.w;
  const x = useMotionValue(-slideIndex * w);
  const target = useRef(slideIndex);

  useEffect(() => {
    if (target.current === slideIndex) {
      x.set(-slideIndex * w);
      return;
    }
    target.current = slideIndex;
    animate(x, -slideIndex * w, SLIDE_SNAP);
  }, [slideIndex, w, x]);

  // Pintasan global (Ctrl+Alt+Space, lihat main.js): buka island ke slide pencarian.
  // Pakai ref supaya listener tidak dipasang ulang tiap render.
  const [searchTick, setSearchTick] = useState(0);
  const hasSearch = menus.some((m) => m.id === "search");
  const latest = useRef({});
  latest.current = { onSlideId, onExpand };
  useEffect(() => {
    if (!hasSearch) return;
    return window.island?.onOpenSearch?.(() => {
      latest.current.onSlideId("search");
      latest.current.onExpand();
      setSearchTick((t) => t + 1);
    });
  }, [hasSearch]);

  const accentStyle = { ["--accent"]: settings.accent };

  const handleIslandClick = (e) => {
    if (!expanded) {
      onExpand();
      return;
    }
    if (
      e.target.closest(
        "button, textarea, input, .notes-list, .notes-date, .cal, .temp, .lyrics, .menu-bar, .controls, .chips, .settings-glass, .todo, .prayer, .notif-apps, .srch, .cv",
      )
    ) {
      return;
    }
    onCollapse();
  };

  return (
    <motion.div
      className={`island ${expanded ? "open" : "closed"}`}
      initial={false}
      animate={{ width: size.w, height: size.h, y: hidden ? HIDDEN_Y : 0 }}
      transition={{ width: SIZE_T, height: SIZE_T, y: VERTICAL }}
      style={{ pointerEvents: hidden ? "none" : "auto", ...accentStyle }}
      onMouseEnter={nativeCursor ? undefined : () => onHover(true)}
      onMouseLeave={nativeCursor ? undefined : () => onHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        handleIslandClick(e);
      }}
    >
      <div
        className={`compact-tint${tintOn ? " on" : ""}`}
        style={tintVars}
        aria-hidden="true"
      />

      <AnimatePresence initial={false}>
        {!expanded && (
          <motion.div
            key={`c-${compactKind}`}
            className="compact-fill"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.06 } }}
          >
            <Compact
              kind={compactKind}
              media={media}
              timer={timer}
              lyrics={lyrics}
              tint={tint}
              loading={switching}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="expanded-fill"
        initial={false}
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={{
          duration: expanded ? 0.2 : 0.08,
          delay: expanded ? 0.08 : 0,
        }}
        style={{
          pointerEvents: expanded ? "auto" : "none",
          // Ukuran tetap (sama dengan ukuran terbuka) dan ditaruh di tengah: pill hanya
          // "membuka tirai". Tanpa ini seluruh isi panel di-layout ulang di tiap frame animasi,
          // yang membuat notch terasa lag saat dibuka.
          inset: "0 auto auto 50%",
          width: expandedSize.w,
          height: expandedSize.h,
          marginLeft: -expandedSize.w / 2,
          contain: "layout paint style",
          visibility: showContent ? "visible" : "hidden",
          contentVisibility: showContent ? "visible" : "hidden",
        }}
      >
        <div className="menu-bar" onClick={(e) => e.stopPropagation()}>
          <div className="menu-icons">
            {menus.map((s) => (
              <MenuItem
                key={s.id}
                Icon={ICON_MAP[s.id]}
                label={s.label}
                active={s.id === activeId}
                onClick={() => onSlideId(s.id)}
              />
            ))}
          </div>
          <MenuClock />
        </div>

        <div className="panel-viewport" style={{ width: w, height: slideH }}>
          <motion.div
            className="panel-track"
            style={{ x, width: w * menus.length, height: slideH }}
          >
            {menus.map((s) => (
              <div
                key={s.id}
                className="panel-slide"
                style={{ width: w, height: slideH }}
              >
                {s.id === "music" && (
                  <MusicSlide
                    media={media}
                    lyrics={lyrics}
                    adPlaying={adPlaying}
                    switching={switching}
                    tint={tint}
                    command={command}
                    active={expanded && activeId === "music"}
                  />
                )}
                {s.id === "timer" && <TimerSlide timer={timer} />}
                {s.id === "notif" && (
                  <NotifAppsSlide
                    items={notifs}
                    meta={notifMeta}
                    onDismiss={onNotifDismiss}
                    onClear={onNotifClear}
                  />
                )}
                {s.id === "list" && (
                  <ListSlide
                    items={todos}
                    onAdd={onTodoAdd}
                    onToggle={onTodoToggle}
                    onRemove={onTodoRemove}
                    onFocusChange={onNotesFocus}
                  />
                )}
                {s.id === "notes" && (
                  <NotesSlide
                    notes={notes}
                    activeId={activeNoteId}
                    onSelect={onNoteSelect}
                    onChange={onNoteChange}
                    onNew={onNoteNew}
                    onDate={onNoteDate}
                    onDelete={onNoteDelete}
                    onFocusChange={onNotesFocus}
                  />
                )}
                {s.id === "clock" && (
                  <ClockSlide notes={notes} onOpenDate={onOpenDate} />
                )}
                {s.id === "search" && (
                  <SearchSlide
                    onFocusChange={onNotesFocus}
                    onDone={onCollapse}
                    focusSignal={searchTick}
                  />
                )}
                {s.id === "prayer" && <PrayerSlide />}
                {s.id === "convert" && <ConvertSlide />}
                {s.id === "temp" && (
                  <TempSlide
                    items={tempItems}
                    onAdd={onTempAdd}
                    onRemove={onTempRemove}
                    onClear={onTempClear}
                  />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
