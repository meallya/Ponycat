import Eq from "./Eq.jsx";
import CatFace from "./CatFace.jsx";
import CompactLyric from "./CompactLyric.jsx";
import LoadingDots from "./LoadingDots.jsx";
import { IconTimer } from "./icons.jsx";
import { fmtTimer } from "../lib/format.js";

export default function Compact({ kind, media, timer, lyrics, tint, loading }) {
  // Lagu sedang berganti: titik loading menggantikan lirik / equalizer
  if (loading && (kind === "lyric" || kind === "music")) {
    return (
      <div
        className="compact-inner"
        style={tint ? { "--clyr-fg": tint.fg } : undefined}
      >
        <LoadingDots />
      </div>
    );
  }
  if (kind === "lyric") {
    return <CompactLyric lyrics={lyrics} media={media} tint={tint} />;
  }
  if (kind === "music") {
    return (
      <div className="compact-inner">
        <Eq on />
      </div>
    );
  }
  if (kind === "timer") {
    return (
      <div className="compact-inner compact-timer">
        <IconTimer size={14} />
        <span className="c-time">{fmtTimer(timer.left)}</span>
      </div>
    );
  }
  // Idle: wajah kucing menggantikan dua titik sensor
  return (
    <div className="compact-inner" style={{ width: "100%", height: "100%" }}>
      <CatFace />
    </div>
  );
}
