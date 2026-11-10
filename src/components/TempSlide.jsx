import { useCallback, useRef, useState } from "react";
import { IconClipboard, IconClose, IconFile, IconImage } from "./icons.jsx";

const MAX_PREVIEW_BYTES = 15 * 1024 * 1024; // jangan bikin preview base64 untuk gambar raksasa

// API native dari preload (Electron). undefined kalau jalan di browser biasa.
const nativeTemp = () =>
  typeof window !== "undefined" ? window.island?.temp : undefined;

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const readPreview = (file) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });

const hasFiles = (e) =>
  Array.from(e.dataTransfer?.types || []).includes("Files");

const fmtSize = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export default function TempSlide({ items, onAdd, onRemove, onClear }) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const dragDepth = useRef(0); // supaya highlight tidak berkedip saat melewati elemen anak

  const hasNative = Boolean(nativeTemp());

  // ------------------------------------------------------------------
  // MASUK: file / folder / gambar -> disalin ke folder temp milik app
  // ------------------------------------------------------------------
  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []); // harus sync, sebelum ada await
      if (!files.length) return;

      const api = nativeTemp();
      const next = [];
      const failed = [];

      for (const f of files) {
        try {
          const isImage = f.type.startsWith("image/");
          let saved = null; // { path, isDir, size }

          // Path asli di disk. Kosong untuk file yang tidak ada di disk
          // (mis. gambar yang diseret dari browser) atau kalau webUtils tidak tersedia.
          const src = api?.getPath ? api.getPath(f) : "";

          if (src && api?.addPath) {
            // Cara utama: main process yang menyalin. Cepat, hemat memori, dan bisa FOLDER.
            // Lewati file yang berasal dari temp kita sendiri (diseret keluar lalu dijatuhkan lagi).
            if (items.some((it) => it.path === src)) continue;
            saved = await api.addPath(src);
          } else if (api?.save) {
            // Cadangan: kirim byte-nya (tidak bisa untuk folder)
            const buf = await f.arrayBuffer();
            const savedPath = await api.save(f.name, new Uint8Array(buf));
            saved = savedPath
              ? { path: savedPath, isDir: false, size: f.size }
              : null;
          }

          if (api && !saved?.path) throw new Error("path tidak didapat");

          const preview =
            isImage && f.size <= MAX_PREVIEW_BYTES
              ? await readPreview(f)
              : null;

          next.push({
            id: newId(),
            name: f.name,
            size: saved?.size ?? f.size,
            type: f.type || "application/octet-stream",
            isImage,
            isDir: Boolean(saved?.isDir),
            preview,
            path: saved?.path ?? null,
          });
        } catch (err) {
          console.warn("Gagal menyimpan:", f.name, err);
          failed.push(f.name);
        }
      }

      setError(failed.length ? `Gagal menyimpan: ${failed.join(", ")}` : "");
      if (next.length) onAdd(next);
    },
    [onAdd, items],
  );

  const onDragEnter = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };

  const onDragOver = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); // wajib, kalau tidak drop tidak akan terpanggil
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    handleFiles(e.dataTransfer?.files);
  };

  // ------------------------------------------------------------------
  // KELUAR: seret item ke Desktop / folder / aplikasi lain
  // ------------------------------------------------------------------
  const onItemDragStart = (e, item) => {
    const api = nativeTemp();
    if (!api?.startDrag || !item.path) return;
    e.preventDefault(); // wajib agar drag native OS yang berjalan
    api.startDrag(item.path);
  };

  const removeItem = (item) => {
    nativeTemp()?.remove?.(item.path); // hapus juga salinan di folder temp
    onRemove(item.id);
  };

  const clearAll = () => {
    const api = nativeTemp();
    items.forEach((it) => api?.remove?.(it.path));
    onClear();
  };

  const statusText = (it) => {
    if (it.path) return "Siap diseret";
    if (!hasNative) return "Mode browser, tidak bisa diseret keluar";
    return "Gagal dimuat ke OS";
  };

  return (
    <div
      className={`temp ${dragOver ? "drag" : ""}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      // Kalau window island pakai -webkit-app-region: drag, event drop akan ditelan.
      style={{ minHeight: "150px", WebkitAppRegion: "no-drag" }}
    >
      {items.length === 0 ? (
        <div
          className="temp-empty"
          onClick={() => inputRef.current?.click()}
          style={{ cursor: "pointer", textAlign: "center", padding: "20px" }}
        >
          <IconClipboard size={20} />
          <div>Seret file / gambar ke sini</div>
          <small>Lalu seret lagi ke tempat tujuan</small>
          <button
            className="temp-pick"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            style={{ marginTop: "10px" }}
          >
            Pilih file
          </button>
        </div>
      ) : (
        <>
          <div
            className="temp-head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px",
            }}
          >
            <span>{items.length} item · Seret ke luar</span>
            <button
              className="temp-clear"
              onClick={clearAll}
              style={{ cursor: "pointer" }}
            >
              Hapus semua
            </button>
          </div>

          <div className="temp-list">
            {items.map((it) => (
              <div
                className="temp-item"
                key={it.id}
                draggable={Boolean(it.path)}
                onDragStart={(e) => onItemDragStart(e, it)}
                title={it.path ? "Seret keluar" : statusText(it)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px",
                  cursor: it.path ? "grab" : "not-allowed",
                  opacity: it.path ? 1 : 0.6,
                }}
              >
                <div className="temp-thumb">
                  {it.isImage && it.preview ? (
                    <img
                      src={it.preview}
                      alt=""
                      draggable={false}
                      style={{
                        width: "40px",
                        height: "40px",
                        objectFit: "cover",
                        borderRadius: "4px",
                      }}
                    />
                  ) : it.isImage ? (
                    <IconImage />
                  ) : (
                    <IconFile />
                  )}
                </div>

                <div className="meta" style={{ flex: 1, minWidth: 0 }}>
                  <div className="title" style={{ fontWeight: "bold" }}>
                    {it.name}
                  </div>
                  <div
                    className="sub"
                    style={{ fontSize: "12px", opacity: 0.7 }}
                  >
                    {it.isDir ? "Folder" : fmtSize(it.size)} · {statusText(it)}
                  </div>
                </div>

                <button
                  className="mini"
                  aria-label="Hapus"
                  onClick={() => removeItem(it)}
                  style={{ cursor: "pointer", padding: "5px" }}
                >
                  <IconClose />
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div role="alert" style={{ padding: "8px 10px", fontSize: "12px" }}>
              {error}
            </div>
          )}

          <button
            className="temp-add-more"
            onClick={() => inputRef.current?.click()}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "10px",
              cursor: "pointer",
            }}
          >
            + Tambah file
          </button>
        </>
      )}

      {items.length === 0 && error && (
        <div role="alert" style={{ padding: "8px 10px", fontSize: "12px" }}>
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
