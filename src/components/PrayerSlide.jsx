import { useEffect, useRef, useState } from "react";
import "./prayer.css";
import PrayerView from "./PrayerView.jsx";
import {
  LOCATION,
  ADZAN_NAMES,
  dayKey,
  timesForDay,
  nextPrayer,
  dueAdzan,
  fmtCountdown,
  hijriLabel,
} from "../lib/prayer.js";
import { createAdzanPlayer } from "../lib/adzan.js";
import { qiblaLabel } from "../lib/qibla.js";
import { playTone } from "../lib/tone.js";

// File adzan: taruh di src/assets/ -> adzan.mp3 (wajib), adzan-subuh.mp3 (opsional, khusus Subuh).
// Format lain yang didukung: ogg, wav, m4a.
const SOUNDS = import.meta.glob("../assets/adzan*.{mp3,ogg,wav,m4a}", {
  eager: true,
  query: "?url",
  import: "default",
});

function soundFor(name) {
  const entries = Object.entries(SOUNDS);
  const find = (re) => entries.find(([path]) => re.test(path))?.[1];
  return (
    (name === "Subuh" && find(/subuh/i)) ||
    find(/adzan\.[a-z0-9]+$/i) ||
    entries[0]?.[1] ||
    null
  );
}

const REMIND_SEC = 10 * 60; // pengingat berbunyi 10 menit sebelum waktu sholat
const REMIND_GRACE = 90; // detik: kalau app baru dibuka lewat dari ini, pengingat tidak berbunyi telat
const QURAN_URL = "https://quran.com";

const ENABLED_KEY = "adzan-enabled"; // kunci lama (tombol speaker), dipakai untuk migrasi saja
const MODE_KEY = "adzan-mode"; // "adzan" | "tone" | "silent"
const REMIND_KEY = "adzan-remind";
const FIRED_KEY = "adzan-fired";

function loadMode() {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === "adzan" || m === "tone" || m === "silent") return m;
    // Pengguna lama: tombol speaker mati = senyap, selain itu adzan penuh
    return localStorage.getItem(ENABLED_KEY) === "0" ? "silent" : "adzan";
  } catch {
    return "adzan";
  }
}

function loadRemind() {
  try {
    return localStorage.getItem(REMIND_KEY) === "1";
  } catch {
    return false;
  }
}

// Daftar adzan/pengingat yang sudah dibunyikan hari ini (supaya reload tidak mengulang)
function loadFired() {
  try {
    const o = JSON.parse(localStorage.getItem(FIRED_KEY) || "null");
    if (o?.day === dayKey()) return new Set(o.ids);
  } catch {
    /* abaikan */
  }
  return new Set();
}

function saveFired(set) {
  try {
    localStorage.setItem(
      FIRED_KEY,
      JSON.stringify({ day: dayKey(), ids: [...set] }),
    );
  } catch {
    /* abaikan */
  }
}

function saveKey(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* abaikan */
  }
}

// Jam 24 jam menurut zona waktu lokasi: "04:10"
const HHMM = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: LOCATION.tz,
});
const hhmm = (date) => HHMM.format(date);

function openQuran() {
  if (window.island?.openExternal) window.island.openExternal(QURAN_URL);
  else window.open(QURAN_URL, "_blank", "noopener,noreferrer");
}

// PrayerSlide harus tetap ter-mount (bukan hanya saat slide aktif) supaya adzan
// tetap berbunyi walau slide lain yang sedang tampil. Sama seperti MusicSlide,
// komponen ini menerima `media` dan `command` dari induknya.
export default function PrayerSlide({
  media,
  command,
  active = true,
  onAdzanChange,
}) {
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState(loadMode);
  const [remind, setRemind] = useState(loadRemind);
  const [playingName, setPlayingName] = useState(null);

  const mediaRef = useRef(media);
  const commandRef = useRef(command);
  const modeRef = useRef(mode);
  const remindRef = useRef(remind);
  const changeRef = useRef(onAdzanChange);
  const firedRef = useRef(null);
  const playerRef = useRef(null);
  mediaRef.current = media;
  commandRef.current = command;
  modeRef.current = mode;
  remindRef.current = remind;
  changeRef.current = onAdzanChange;

  if (!firedRef.current) firedRef.current = loadFired();
  if (!playerRef.current) {
    playerRef.current = createAdzanPlayer({
      getMedia: () => mediaRef.current,
      command: (c) => commandRef.current?.(c),
      onChange: (name) => {
        setPlayingName(name);
        changeRef.current?.(name);
      },
    });
  }
  const player = playerRef.current;

  // Tampilan: jam berdetak tiap detik saat slide aktif, jarang saat tidak terlihat
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), active ? 1000 : 30000);
    return () => clearInterval(id);
  }, [active]);

  // Penjadwal adzan + pengingat: selalu jalan, tidak bergantung pada slide yang tampil
  useEffect(() => {
    const tick = () => {
      const t = new Date();

      const due = dueAdzan(t, firedRef.current);
      if (due) {
        // Tandai sudah lewat walau sedang senyap, supaya tidak berbunyi telat saat dinyalakan lagi
        firedRef.current.add(due.id);
        saveFired(firedRef.current);
        if (modeRef.current === "adzan" && !player.current) {
          const src = soundFor(due.name);
          if (src) player.start(due.name, src);
          else
            console.warn(
              "[adzan] file adzan tidak ditemukan di src/assets (adzan.mp3)",
            );
        } else if (modeRef.current === "tone") {
          playTone();
        }
      }

      // Pengingat 10 menit sebelum: hanya nada pendek, bukan adzan penuh
      if (remindRef.current && modeRef.current !== "silent") {
        const nx = nextPrayer(t);
        const left = (nx.at - t) / 1000;
        const id = `${dayKey(nx.at)}|pre|${nx.name}`;
        if (
          left <= REMIND_SEC &&
          left > REMIND_SEC - REMIND_GRACE &&
          !firedRef.current.has(id)
        ) {
          firedRef.current.add(id);
          saveFired(firedRef.current);
          playTone();
        }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      player.stop(); // kalau komponen dilepas saat adzan, musik tetap dilanjutkan
    };
  }, [player]);

  // Untuk uji coba di DevTools: testAdzan('Dzuhur')
  useEffect(() => {
    if (!import.meta.env?.DEV) return;
    window.testAdzan = (name = "Dzuhur") => {
      const src = soundFor(name);
      return src
        ? player.start(name, src)
        : console.warn("[adzan] file adzan belum ada di src/assets");
    };
    return () => {
      delete window.testAdzan;
    };
  }, [player]);

  const changeMode = (m) => {
    setMode(m);
    saveKey(MODE_KEY, m);
    if (m !== "adzan") player.stop();
    if (m === "tone") playTone(); // contoh suara saat dipilih
  };

  const toggleRemind = () => {
    const nextVal = !remind;
    setRemind(nextVal);
    saveKey(REMIND_KEY, nextVal ? "1" : "0");
  };

  // Data tampilan. Setelah Isya, sholat berikutnya adalah Subuh besok, jadi seluruh
  // jadwal yang tampil (Imsak, Terbit, lima waktu) ikut jadwal besok.
  const next = nextPrayer(now);
  const leftSec = Math.ceil((next.at - now) / 1000);
  const times = timesForDay(dayKey(next.at));
  const nextIdx = ADZAN_NAMES.indexOf(next.name);

  const prayers = ADZAN_NAMES.map((name, i) => ({
    name,
    time: hhmm(times[name]),
    state: i === nextIdx ? "next" : i < nextIdx ? "past" : "later",
  }));

  const info = [`Imsak ${hhmm(times.Imsak)}`, `Terbit ${hhmm(times.Terbit)}`];
  const qibla = qiblaLabel(LOCATION.lat, LOCATION.lng);
  if (qibla) info.push(`Kiblat ${qibla}`);

  return (
    <PrayerView
      nextName={next.name}
      countdown={fmtCountdown(leftSec)}
      nextAt={hhmm(next.at)}
      nextIsTomorrow={next.tomorrow}
      place={LOCATION.name}
      sub={hijriLabel(now)}
      info={info}
      prayers={prayers}
      playingName={playingName}
      onStop={() => player.stop()}
      mode={mode}
      onMode={changeMode}
      remind={remind}
      onRemind={toggleRemind}
      onQuran={openQuran}
    />
  );
}
