"use strict";
// Konversi file & gambar di main process. Semua offline, tanpa web lain.
//  - Gambar  : pakai `sharp`   (png, jpg, webp, avif, tiff, gif, svg) + `pdf-lib` untuk ke PDF
//  - Dokumen : pakai LibreOffice (headless) kalau terpasang (docx, odt, rtf, txt, html, xlsx, csv, pptx, ...)
// Hasil disimpan di <Downloads>/Converted.

const { app, ipcMain, shell, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execFile, execFileSync } = require("child_process");
const { pathToFileURL } = require("url");

const MAX_BYTES = 500 * 1024 * 1024;

// ---------- Peta format ----------
const IMG_IN = ["jpg", "png", "webp", "gif", "avif", "tiff", "svg"];
const IMG_OUT = ["png", "jpg", "webp", "avif", "tiff", "gif", "pdf"];
const FAMILIES = {
  text: {
    in: ["doc", "docx", "odt", "rtf", "txt", "html"],
    out: ["pdf", "docx", "odt", "rtf", "txt", "html"],
  },
  sheet: {
    in: ["xls", "xlsx", "ods", "csv"],
    out: ["pdf", "xlsx", "ods", "csv"],
  },
  slide: {
    in: ["ppt", "pptx", "odp"],
    out: ["pdf", "pptx", "odp"],
  },
};

// Nama filter LibreOffice per format tujuan
const LO_FILTER = {
  pdf: "pdf",
  docx: "docx:MS Word 2007 XML",
  odt: "odt",
  rtf: "rtf",
  txt: "txt:Text (encoded):UTF8",
  html: "html",
  xlsx: "xlsx:Calc MS Excel 2007 XML",
  ods: "ods",
  csv: "csv:Text - txt - csv (StarCalc):44,34,76,1",
  pptx: "pptx:Impress MS PowerPoint 2007 XML",
  odp: "odp",
};

const norm = (ext) => {
  const e = String(ext || "")
    .replace(/^\./, "")
    .toLowerCase();
  return { jpeg: "jpg", jpe: "jpg", tif: "tiff", htm: "html" }[e] || e;
};

function kindOf(ext) {
  if (IMG_IN.includes(ext)) return "image";
  for (const [k, f] of Object.entries(FAMILIES))
    if (f.in.includes(ext)) return k;
  return null;
}

// ---------- Dependensi opsional (tidak boleh membuat app crash kalau belum terpasang) ----------
let _sharp;
function getSharp() {
  if (_sharp === undefined) {
    try {
      _sharp = require("sharp");
    } catch (e) {
      console.warn("[convert] sharp belum terpasang: npm i sharp");
      _sharp = null;
    }
  }
  return _sharp;
}

let _pdfLib;
function getPdfLib() {
  if (_pdfLib === undefined) {
    try {
      _pdfLib = require("pdf-lib");
    } catch (e) {
      console.warn("[convert] pdf-lib belum terpasang: npm i pdf-lib");
      _pdfLib = null;
    }
  }
  return _pdfLib;
}

let _soffice = null;
function findSoffice() {
  if (_soffice && fs.existsSync(_soffice)) return _soffice;
  _soffice = null;
  const cands = [];
  if (process.platform === "win32") {
    const bases = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA &&
        path.join(process.env.LOCALAPPDATA, "Programs"),
    ];
    for (const b of bases)
      if (b) cands.push(path.join(b, "LibreOffice", "program", "soffice.exe"));
  } else if (process.platform === "darwin") {
    cands.push("/Applications/LibreOffice.app/Contents/MacOS/soffice");
  } else {
    cands.push(
      "/usr/bin/soffice",
      "/usr/bin/libreoffice",
      "/usr/local/bin/soffice",
      "/snap/bin/libreoffice",
      "/opt/libreoffice/program/soffice",
    );
  }
  // Cari juga di PATH
  const exts = process.platform === "win32" ? [".exe", ".com"] : [""];
  for (const dir of String(process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const n of ["soffice", "libreoffice"])
      for (const x of exts) cands.push(path.join(dir, n + x));
  }
  for (const c of cands) {
    try {
      if (fs.statSync(c).isFile()) return (_soffice = c);
    } catch {
      // lanjut
    }
  }
  return null;
}

// ---------- Microsoft Office (Windows, lewat COM + PowerShell) ----------
// Dicoba lebih dulu kalau terpasang; LibreOffice jadi cadangan.
const OFFICE_PROGID = {
  text: "Word.Application",
  sheet: "Excel.Application",
  slide: "PowerPoint.Application",
};

// Kode format bawaan Office (wdSaveFormat / xlFileFormat / ppSaveAsFileType)
const OFFICE_FMT = {
  text: { pdf: 17, docx: 16, odt: 23, rtf: 6, txt: 2, html: 8 },
  sheet: { pdf: "pdf", xlsx: 51, ods: 60, csv: 62 },
  slide: { pdf: 32, pptx: 24, odp: 35 },
};

const officeCache = new Map(); // kind -> { ok, at }
function officeFor(kind) {
  if (process.platform !== "win32" || !OFFICE_PROGID[kind]) return false;
  const c = officeCache.get(kind);
  if (c && Date.now() - c.at < 30000) return c.ok;
  let ok = false;
  for (const view of ["/reg:64", "/reg:32"]) {
    try {
      execFileSync(
        "reg",
        ["query", `HKCR\\${OFFICE_PROGID[kind]}\\CLSID`, view],
        {
          stdio: "ignore",
          windowsHide: true,
        },
      );
      ok = true;
      break;
    } catch {
      // coba view berikutnya
    }
  }
  officeCache.set(kind, { ok, at: Date.now() });
  return ok;
}

// Path & format dikirim lewat environment variable, bukan disisipkan ke teks skrip,
// supaya nama file apa pun aman. Office user yang sedang terbuka tidak ditutup.
const OFFICE_PS = `
$ErrorActionPreference = 'Stop'
$src = $env:DI_SRC; $out = $env:DI_OUT; $kind = $env:DI_KIND; $fmt = $env:DI_FMT
$m = [Type]::Missing
$app = $null; $doc = $null; $code = 0
try {
  if ($kind -eq 'text') {
    $app = New-Object -ComObject Word.Application
    $app.Visible = $false
    $app.DisplayAlerts = 0
    $doc = $app.Documents.Open($src, $false, $true)
    if ($fmt -eq '17') { $doc.ExportAsFixedFormat($out, 17) }
    elseif ($fmt -eq '2') { $doc.SaveAs2($out, 2, $m, $m, $m, $m, $m, $m, $m, $m, $m, 65001) }
    else { $doc.SaveAs2($out, [int]$fmt) }
  } elseif ($kind -eq 'sheet') {
    $app = New-Object -ComObject Excel.Application
    $app.Visible = $false
    $app.DisplayAlerts = $false
    $doc = $app.Workbooks.Open($src, 0, $true)
    if ($fmt -eq 'pdf') { $doc.ExportAsFixedFormat(0, $out) }
    else { $doc.SaveAs($out, [int]$fmt) }
  } else {
    $app = New-Object -ComObject PowerPoint.Application
    $doc = $app.Presentations.Open($src, -1, 0, 0)
    $doc.SaveAs($out, [int]$fmt)
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  $code = 1
}
try {
  if ($doc) {
    if ($kind -eq 'text') { $doc.Close(0) }
    elseif ($kind -eq 'sheet') { $doc.Close($false) }
    else { $doc.Close() }
  }
} catch {}
try {
  if ($app) {
    if ($kind -eq 'text') { $n = $app.Documents.Count }
    elseif ($kind -eq 'sheet') { $n = $app.Workbooks.Count }
    else { $n = $app.Presentations.Count }
    if ($n -eq 0) { $app.Quit() }
  }
} catch {}
exit $code
`;

function officeConvert(kind, src, target, out) {
  return new Promise((resolve, reject) => {
    const fmt = OFFICE_FMT[kind] && OFFICE_FMT[kind][target];
    if (fmt === undefined)
      return reject(new Error("Format tujuan tidak didukung"));
    const encoded = Buffer.from(OFFICE_PS, "utf16le").toString("base64");
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        encoded,
      ],
      {
        timeout: 180000,
        windowsHide: true,
        env: {
          ...process.env,
          DI_SRC: src,
          DI_OUT: out,
          DI_KIND: kind,
          DI_FMT: String(fmt),
        },
      },
      (err, _stdout, stderr) => {
        if (err) {
          try {
            fs.unlinkSync(out);
          } catch {
            // belum ada file
          }
          const msg = String(stderr || err.message)
            .trim()
            .split(/\r?\n/)[0];
          return reject(new Error(msg || "Office gagal"));
        }
        if (!fs.existsSync(out))
          return reject(new Error("Office tidak menghasilkan file"));
        resolve();
      },
    );
  });
}

// ---------- Utilitas file ----------
const outputDir = () => path.join(app.getPath("downloads"), "Converted");
const insideOutput = (p) =>
  typeof p === "string" && path.resolve(p).startsWith(outputDir() + path.sep);

function uniquePath(dir, base, ext) {
  const safe = String(base || "file").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  let p = path.join(dir, `${safe}.${ext}`);
  for (let i = 1; fs.existsSync(p); i++)
    p = path.join(dir, `${safe} (${i}).${ext}`);
  return p;
}

function moveFile(from, to) {
  try {
    fs.renameSync(from, to);
  } catch {
    // beda drive: salin lalu hapus
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

// Ikon hasil (startDrag wajib punya ikon yang tidak kosong), disimpan saat file selesai dibuat
const icons = new Map();
async function rememberIcon(p, ext) {
  try {
    let icon = null;
    if (ext === "png" || ext === "jpg") {
      icon = nativeImage.createFromPath(p);
      if (!icon.isEmpty()) icon = icon.resize({ width: 64 });
    }
    if (!icon || icon.isEmpty()) icon = await app.getFileIcon(p);
    icons.set(p, icon);
  } catch (e) {
    console.error("[convert:icon]", e);
  }
}

// ---------- Deteksi format ----------
function describe(p) {
  const name = typeof p === "string" ? path.basename(p) : String(p);
  const ext = norm(path.extname(name));
  const info = {
    path: p,
    name,
    ext,
    size: 0,
    kind: null,
    targets: [],
    reason: null,
  };

  let st = null;
  try {
    if (typeof p === "string" && path.isAbsolute(p)) st = fs.statSync(p);
  } catch {
    // st tetap null
  }
  if (!st || !st.isFile()) return { ...info, reason: "not-file" };
  info.size = st.size;
  if (st.size > MAX_BYTES) return { ...info, reason: "too-big" };

  const kind = kindOf(ext);
  if (!kind) return { ...info, reason: "unsupported" };
  info.kind = kind;

  let targets;
  if (kind === "image") {
    if (!getSharp()) return { ...info, reason: "needs-sharp" };
    targets = IMG_OUT.filter((t) => t !== "pdf" || getPdfLib());
  } else {
    if (!officeFor(kind) && !findSoffice())
      return { ...info, reason: "needs-libreoffice" };
    targets = FAMILIES[kind].out;
  }
  info.targets = targets.filter((t) => t !== ext);
  return info;
}

// ---------- Konversi ----------
async function imageToImage(src, inExt, target, out) {
  const sharp = getSharp();
  const animated =
    (target === "gif" || target === "webp") &&
    (inExt === "gif" || inExt === "webp");
  const opts = {};
  if (animated) opts.animated = true;
  if (inExt === "svg") opts.density = 192;
  let img = sharp(src, opts);
  if (!animated) img = img.rotate(); // hormati orientasi EXIF
  switch (target) {
    case "png":
      img = img.png({ compressionLevel: 9 });
      break;
    case "jpg":
      img = img
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 90, mozjpeg: true });
      break;
    case "webp":
      img = img.webp({ quality: 90 });
      break;
    case "avif":
      img = img.avif({ quality: 60 });
      break;
    case "tiff":
      img = img.tiff({ compression: "lzw" });
      break;
    case "gif":
      img = img.gif();
      break;
    default:
      throw new Error("Format gambar tidak didukung");
  }
  await img.toFile(out);
}

async function imagesToPdf(infos, out) {
  const sharp = getSharp();
  const { PDFDocument } = getPdfLib();
  const pdf = await PDFDocument.create();
  for (const { path: src, ext } of infos) {
    const base = sharp(src, ext === "svg" ? { density: 192 } : {}).rotate();
    let img;
    if (ext === "jpg") {
      const buf = await base
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 92 })
        .toBuffer();
      img = await pdf.embedJpg(buf);
    } else {
      img = await pdf.embedPng(await base.png().toBuffer());
    }
    // Halaman mengikuti ukuran gambar, dibatasi sisi terpanjang 842pt (A4)
    const k = Math.min(1, 842 / Math.max(img.width, img.height));
    const w = img.width * k;
    const h = img.height * k;
    pdf.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
  fs.writeFileSync(out, await pdf.save());
}

function docConvert(soffice, src, inExt, target, out) {
  return new Promise((resolve, reject) => {
    const work = path.join(
      os.tmpdir(),
      "dynamic-island-convert",
      crypto.randomUUID(),
    );
    fs.mkdirSync(work, { recursive: true });
    // Profil terpisah supaya tidak bentrok dengan LibreOffice yang sedang dibuka user
    const profile = pathToFileURL(
      path.join(app.getPath("userData"), "lo-profile"),
    ).href;
    let filter = LO_FILTER[target];
    if (!filter) return reject(new Error("Format tujuan tidak didukung"));
    if (inExt === "html" && target === "pdf")
      filter = "pdf:writer_web_pdf_Export";
    const args = [
      "--headless",
      "--norestore",
      "--nolockcheck",
      "--nologo",
      `-env:UserInstallation=${profile}`,
      "--convert-to",
      filter,
      "--outdir",
      work,
      src,
    ];
    execFile(
      soffice,
      args,
      { timeout: 180000, windowsHide: true },
      (err, _stdout, stderr) => {
        try {
          if (err)
            throw new Error(
              String(stderr || err.message)
                .trim()
                .split("\n")[0] || "LibreOffice gagal",
            );
          const produced = path.join(
            work,
            path.basename(src, path.extname(src)) + "." + target,
          );
          if (!fs.existsSync(produced))
            throw new Error("LibreOffice tidak menghasilkan file");
          moveFile(produced, out);
          resolve();
        } catch (e) {
          reject(e);
        } finally {
          fs.rmSync(work, { recursive: true, force: true });
        }
      },
    );
  });
}

// Office dulu, kalau gagal atau tidak ada pakai LibreOffice
async function convertDoc(info, target, out) {
  const { path: src, ext, kind } = info;
  if (officeFor(kind)) {
    try {
      await officeConvert(kind, src, target, out);
      return;
    } catch (e) {
      if (!findSoffice()) throw e;
      console.warn("[convert] Office gagal, memakai LibreOffice:", e.message);
    }
  }
  await docConvert(findSoffice(), src, ext, target, out);
}

const REASON_TEXT = {
  "not-file": "Bukan file",
  "too-big": "Lebih dari 500 MB",
  unsupported: "Format belum didukung",
  "needs-libreoffice": "Butuh Office atau LibreOffice",
  "needs-sharp": "Modul sharp belum terpasang",
};

async function runJob(job, send) {
  const target = norm(job && job.target);
  const results = [];
  const fail = (id, error) => {
    const r = { id, status: "error", error: String(error).slice(0, 200) };
    results.push(r);
    send(r);
  };
  const done = (id, out) => {
    const r = { id, status: "done", out, outName: path.basename(out) };
    results.push(r);
    send(r);
  };

  const dir = outputDir();
  fs.mkdirSync(dir, { recursive: true });

  const items = (Array.isArray(job && job.items) ? job.items : [])
    .slice(0, 50)
    .map((it) => ({ id: it.id, info: describe(it.path) }));

  const valid = [];
  for (const it of items) {
    if (it.info.targets.includes(target)) valid.push(it);
    else
      fail(
        it.id,
        it.info.reason
          ? REASON_TEXT[it.info.reason]
          : "Format tujuan tidak didukung",
      );
  }

  // Beberapa gambar -> satu PDF
  if (
    job.merge &&
    target === "pdf" &&
    valid.length > 1 &&
    valid.every((i) => i.info.kind === "image")
  ) {
    valid.forEach((i) => send({ id: i.id, status: "run" }));
    try {
      const out = uniquePath(dir, "Gabungan", "pdf");
      await imagesToPdf(
        valid.map((i) => i.info),
        out,
      );
      await rememberIcon(out, "pdf");
      valid.forEach((i) => done(i.id, out));
    } catch (e) {
      valid.forEach((i) => fail(i.id, e.message));
    }
    return results;
  }

  for (const it of valid) {
    send({ id: it.id, status: "run" });
    try {
      const { path: src, ext, name, kind } = it.info;
      const out = uniquePath(
        dir,
        path.basename(name, path.extname(name)),
        target,
      );
      if (kind === "image") {
        if (target === "pdf") await imagesToPdf([it.info], out);
        else await imageToImage(src, ext, target, out);
      } else {
        await convertDoc(it.info, target, out);
      }
      await rememberIcon(out, target);
      done(it.id, out);
    } catch (e) {
      console.error("[convert:run]", e);
      fail(it.id, e.message || "Gagal");
    }
  }
  return results;
}

// ---------- IPC ----------
function registerConvert({ getWin }) {
  const send = (evt) => {
    const w = getWin && getWin();
    if (w && !w.isDestroyed()) w.webContents.send("convert:progress", evt);
  };

  // Antrean: satu job pada satu waktu (LibreOffice tidak suka berjalan paralel)
  let chain = Promise.resolve();
  const enqueue = (fn) => {
    const next = chain.catch(() => {}).then(fn);
    chain = next;
    return next;
  };

  ipcMain.handle("convert:probe", (_e, paths) => {
    const list = (Array.isArray(paths) ? paths : []).slice(0, 50);
    return {
      files: list.map(describe),
      docs: !!findSoffice(),
      images: !!getSharp(),
    };
  });

  ipcMain.handle("convert:run", (_e, job) =>
    enqueue(() => runJob(job || {}, send)),
  );

  // Dialog "Pilih file". Window island tidak bisa fokus secara default, jadi dibuat bisa
  // fokus dulu supaya dialog muncul di depan, lalu dikembalikan seperti semula.
  ipcMain.handle("convert:pick", async () => {
    const w = getWin && getWin();
    const alive = w && !w.isDestroyed();
    try {
      if (alive) {
        w.setFocusable(true);
        w.focus();
      }
      const exts = [
        ...IMG_IN,
        "jpeg",
        "tif",
        ...Object.values(FAMILIES).flatMap((f) => f.in),
        "htm",
      ];
      const opts = {
        title: "Pilih file untuk dikonversi",
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "Gambar & dokumen", extensions: exts },
          { name: "Semua file", extensions: ["*"] },
        ],
      };
      const r = await (alive
        ? dialog.showOpenDialog(w, opts)
        : dialog.showOpenDialog(opts));
      return r.canceled ? [] : r.filePaths;
    } catch (e) {
      console.error("[convert:pick]", e);
      return [];
    } finally {
      if (alive && !w.isDestroyed()) {
        w.setFocusable(false);
        w.setAlwaysOnTop(true, "screen-saver");
      }
    }
  });

  ipcMain.handle("convert:reveal", (_e, p) => {
    if (insideOutput(p) && fs.existsSync(p)) shell.showItemInFolder(p);
  });

  ipcMain.handle("convert:open-folder", async () => {
    const dir = outputDir();
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
  });

  // Seret hasil konversi ke aplikasi lain (Explorer, browser, chat, dll)
  ipcMain.on("convert:start-drag", (event, p) => {
    try {
      if (!insideOutput(p) || !fs.existsSync(p)) return;
      let icon = icons.get(p);
      if (!icon || icon.isEmpty()) icon = nativeImage.createFromPath(p);
      event.sender.startDrag({ file: p, icon });
    } catch (e) {
      console.error("[convert:start-drag]", e);
    }
  });
}

module.exports = { registerConvert, describe, norm, kindOf };
