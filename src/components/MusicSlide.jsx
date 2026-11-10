import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconPrev,
  IconNext,
  IconPlay,
  IconPause,
  IconNote,
  IconVolDown,
  IconVolUp,
  IconVolMute,
} from "./icons.jsx";
import { fmtTime, prettyApp } from "../lib/format.js";
import { findLine } from "../lib/lyrics.js";
import { LYRIC_LEAD } from "../hooks/useLyrics.js";
import { fetchAlbumArt } from "../lib/albumArt.js";

const clamp = (v, max) => Math.max(0, max > 0 ? Math.min(v, max) : v);

// Update posisi lewat rAF supaya lirik ikut frame, bukan interval kasar.
const TICK_MS = 50;

export default function MusicSlide({ media, command, active, lyrics, tint }) {
  const [pos, setPos] = useState(0);
  const [nativeFailed, setNativeFailed] = useState(false);
  const [webArt, setWebArt] = useState(null);
  const lyricRef = useRef(null);

  const nativeArt = media?.thumbnail || null;
  const needWebArt = Boolean(
    media?.hasSession && media.title && (!nativeArt || nativeFailed),
  );

  useEffect(() => {
    if (!media?.hasSession) return;
    const calc = () => {
      const elapsed =
        media.status === "playing"
          ? (performance.now() - media.receivedAt) / 1000
          : 0;
      return clamp(media.position + elapsed, media.duration);
    };
    setPos(calc());
    if (!active || media.status !== "playing") return;
    let id;
    let last = 0;
    const loop = (t) => {
      if (t - last >= TICK_MS) {
        last = t;
        setPos(calc());
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [media, active]);

  // Reset status gagal saat lagu / thumbnail berganti
  useEffect(() => {
    setNativeFailed(false);
  }, [media?.title, media?.artist, nativeArt]);

  // Cari cover lewat internet kalau thumbnail bawaan Windows tidak ada
  useEffect(() => {
    setWebArt(null);
    if (!needWebArt) return;
    let cancelled = false;
    fetchAlbumArt(media.title, media.artist || "", media.album || "").then(
      (url) => {
        if (!cancelled) setWebArt(url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [needWebArt, media?.title, media?.artist, media?.album]);

  // Baris aktif dihitung langsung dari posisi (tanpa state tambahan = tanpa delay 1 render)
  const lyricIdx = useMemo(() => {
    if (!lyrics?.synced) return -1;
    return findLine(lyrics.lines, pos + LYRIC_LEAD);
  }, [lyrics, pos]);

  // Scroll instan (bukan smooth) supaya highlight tidak terasa telat vs suara.
  useEffect(() => {
    if (!lyrics?.synced || lyricIdx < 0) return;
    const el = lyricRef.current?.querySelector(`[data-i="${lyricIdx}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "auto" });
  }, [lyricIdx, lyrics]);

  if (media?.unsupported) {
    return (
      <div className="empty">
        <IconNote />
        <div>Deteksi musik butuh Windows 10 (1809) atau lebih baru</div>
      </div>
    );
  }

  if (!media?.hasSession || (!media.title && !media.artist)) {
    return (
      <div className="empty">
        <IconNote />
        <div>Belum ada musik yang diputar</div>
        <small>
          Putar lagu di Spotify, YouTube, dll. Cover album ikut tampil
        </small>
      </div>
    );
  }

  const playing = media.status === "playing";
  const hasDuration = media.duration > 0;
  const percent = hasDuration ? Math.min(100, (pos / media.duration) * 100) : 0;
  const source = prettyApp(media.app);
  const art = (!nativeFailed && nativeArt) || webArt;

  return (
    <div
      className="music music-split"
      style={tint ? { "--tint-fg": tint.fg } : undefined}
    >
      <div className="music-left">
        {/* Cover album seperti Spotify */}
        <div className="album-art-wrap">
          {art ? (
            <img
              key={art}
              className="album-art"
              src={art}
              alt={media.title || "Album"}
              draggable={false}
              onError={() => {
                if (art === nativeArt) setNativeFailed(true);
                else setWebArt(null);
              }}
            />
          ) : (
            <div className="album-art album-art-fallback" />
          )}
        </div>
        <div className="music-info">
          <div className="title">{media.title || "Tanpa judul"}</div>
          <div className="sub">
            {[media.artist, media.album, source].filter(Boolean).join(" · ")}
          </div>
          <div className="progress-row">
            <span>{fmtTime(pos)}</span>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${percent}%` }} />
            </div>
            <span>{hasDuration ? fmtTime(media.duration) : "--:--"}</span>
          </div>
          <div className="controls">
            <div className="transport">
              <button
                type="button"
                aria-label="Sebelumnya"
                onClick={() => command("prev")}
              >
                <IconPrev size={18} />
              </button>
              <button
                type="button"
                className="play"
                aria-label={playing ? "Jeda" : "Putar"}
                onClick={() => command("play-pause")}
              >
                {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
              </button>
              <button
                type="button"
                aria-label="Berikutnya"
                onClick={() => command("next")}
              >
                <IconNext size={18} />
              </button>
            </div>
            <div className="vol-group" aria-label="Volume">
              <button
                type="button"
                aria-label="Volume turun"
                onClick={() => command("vol-down")}
              >
                <IconVolDown size={13} />
              </button>
              <button
                type="button"
                className="vol-mute"
                aria-label="Mute"
                onClick={() => command("vol-mute")}
              >
                <IconVolMute size={13} />
              </button>
              <button
                type="button"
                aria-label="Volume naik"
                onClick={() => command("vol-up")}
              >
                <IconVolUp size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="music-right">
        <div className="lyrics" ref={lyricRef}>
          {lyrics === undefined && (
            <div className="lyrics-hint">Mencari lirik…</div>
          )}
          {lyrics === null && (
            <div className="lyrics-hint">Lirik tidak ditemukan</div>
          )}
          {lyrics?.lines?.map((line, i) => (
            <div
              key={i}
              data-i={i}
              className={`lyrics-line ${i === lyricIdx ? "on" : ""} ${lyrics.synced ? "" : "plain"}`}
            >
              <div className="lyric-text">{line.text || " "}</div>
              {line.roma && <div className="lyric-roma">{line.roma}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
