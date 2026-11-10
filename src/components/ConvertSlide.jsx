import { useState } from "react";
import useConvert from "../hooks/useConvert.js";
import { IconMenuConvert } from "./ConvertIcon.jsx";
import "./convert.css";

const REASON = {
  "not-file": "Folder tidak didukung",
  "too-big": "Lebih dari 500 MB",
  unsupported: "Format belum didukung",
  "needs-libreoffice": "Butuh Office atau LibreOffice",
  "needs-sharp": "Modul sharp belum terpasang",
};

function fmtSize(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Row({ it, cv }) {
  const blocked = !it.targets.length;
  let meta = fmtSize(it.size);
  if (blocked) meta = REASON[it.reason] || "Tidak didukung";
  else if (it.status === "wait") meta = "Menunggu…";
  else if (it.status === "run") meta = "Memproses…";
  else if (it.status === "done") meta = it.outName;
  else if (it.status === "error") meta = it.error || "Gagal";

  return (
    <div className={`cv-row ${blocked ? "blocked" : it.status}`}>
      <span className="cv-ext">{it.ext || "?"}</span>
      <span className="cv-name" title={it.name}>
        {it.name}
      </span>
      <span className="cv-meta" title={it.status === "error" ? it.error : meta}>
        {meta}
      </span>

      {it.status === "done" && (
        <>
          <span
            className="cv-grab"
            draggable
            title="Seret ke aplikasi atau folder lain"
            onDragStart={(e) => {
              e.preventDefault();
              cv.startDrag(it.out);
            }}
          >
            ⠿
          </span>
          <button
            type="button"
            className="cv-mini"
            title="Tampilkan di folder"
            aria-label="Tampilkan di folder"
            onClick={() => cv.reveal(it.out)}
          >
            ↗
          </button>
        </>
      )}
      <button
        type="button"
        className="cv-mini"
        title="Hapus dari daftar"
        aria-label="Hapus dari daftar"
        disabled={it.status === "run" || it.status === "wait"}
        onClick={() => cv.remove(it.id)}
      >
        ×
      </button>
    </div>
  );
}

export default function ConvertSlide() {
  const cv = useConvert();
  const [over, setOver] = useState(false);
  const empty = cv.items.length === 0;
  const anyDone = cv.items.some((i) => i.status === "done");

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setOver(true);
  };
  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation(); // jangan sampai handler drop global (slide Drop File) ikut menangkap
    setOver(false);
    cv.addFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`cv ${over ? "over" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {empty ? (
        <div className="cv-empty">
          <IconMenuConvert size={26} />
          <b>Seret file ke sini untuk dikonversi</b>
          <span>
            Gambar (PNG, JPG, WEBP, AVIF, GIF, TIFF, SVG) dan dokumen (DOCX,
            XLSX, PPTX, TXT, …)
          </span>
          <button type="button" className="cv-chip cv-pick" onClick={cv.pick}>
            Pilih file…
          </button>
          {cv.notice && <span className="cv-warn">{cv.notice}</span>}
        </div>
      ) : (
        <>
          <div className="cv-list">
            {cv.items.map((it) => (
              <Row key={it.id} it={it} cv={cv} />
            ))}
          </div>

          <div className="cv-bar">
            <div className="cv-chips">
              {cv.targets.length ? (
                cv.targets.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`cv-chip ${cv.target === t ? "on" : ""}`}
                    disabled={cv.busy}
                    onClick={() => cv.setTarget(t)}
                  >
                    {t}
                  </button>
                ))
              ) : (
                <span className="cv-note">
                  Tidak ada format tujuan yang cocok
                </span>
              )}
              {cv.canMerge && (
                <button
                  type="button"
                  className={`cv-chip merge ${cv.merge ? "on" : ""}`}
                  disabled={cv.busy}
                  onClick={() => cv.setMerge(!cv.merge)}
                >
                  Gabung 1 PDF
                </button>
              )}
            </div>

            <div className="cv-actions">
              <button
                type="button"
                className="cv-chip"
                disabled={cv.busy}
                onClick={cv.pick}
              >
                + Tambah
              </button>
              {anyDone && (
                <button
                  type="button"
                  className="cv-chip"
                  onClick={cv.openFolder}
                >
                  Buka folder
                </button>
              )}
              <button
                type="button"
                className="cv-chip"
                disabled={cv.busy}
                onClick={cv.clear}
              >
                Bersihkan
              </button>
              <button
                type="button"
                className="cv-go"
                disabled={cv.busy || !cv.target || !cv.eligibleCount}
                onClick={cv.run}
              >
                {cv.busy ? "Memproses…" : "Convert"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
