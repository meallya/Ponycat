// Pencarian & peluncur aplikasi (Windows).
// Simpan sebagai electron/launcher.js, lalu di main.js cukup: require('./launcher')
const { app, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { execFile, spawn } = require("child_process");

const IS_WIN = process.platform === "win32";
const REINDEX_AFTER_MS = 5 * 60 * 1000; // aplikasi yang baru diinstal muncul tanpa perlu restart

// Shortcut sampah yang ikut terpasang di Start Menu
const SKIP = /uninstall|readme|release notes|license|documentation|website/i;

let entries = new Map(); // id -> { id, name, kind: 'desktop' | 'store', path?, appId?, appKey?, installDir? }
let builtAt = 0;
const iconCache = new Map(); // id -> { url, bg? } | null

// ---------- Ikon (fungsi murni, tanpa Electron) ----------
// <pure-helpers>
const expandEnv = (p) =>
  String(p).replace(
    /%([^%]+)%/g,
    (m, k) => process.env[k] ?? process.env[k.toUpperCase()] ?? m,
  );

const attrOf = (tag, name) => {
  const m = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(tag);
  return m ? m[1] : null;
};

// Ambil tag <VisualElements> milik aplikasi dengan Id tertentu dari AppxManifest.xml
function visualElementsFor(manifest, appKey) {
  const re = /<Application\b([^>]*)>([\s\S]*?)<\/Application>/gi;
  let first = null;
  let m;
  while ((m = re.exec(manifest))) {
    const ve = /<(?:\w+:)?VisualElements\b[^>]*>/i.exec(m[2]);
    if (!ve) continue;
    first = first || ve[0];
    const id = attrOf(m[1], "Id");
    if (appKey && id && id.toLowerCase() === appKey.toLowerCase()) return ve[0];
  }
  return first;
}

// Logo aplikasi Store punya banyak varian (scale-100/200, targetsize-48, altform-unplated, dst).
// Pilih yang ukurannya paling dekat 64px; varian "unplated" (tanpa alas warna) lebih disukai
// karena UI island gelap. Varian high-contrast dan tema terang dibuang.
function pickLogo(installDir, rel) {
  const full = path.join(installDir, ...String(rel).split(/[\\/]/));
  const dir = path.dirname(full);
  const ext = path.extname(full).toLowerCase();
  const base = path.basename(full, path.extname(full)).toLowerCase();
  const nominal = Number((/(\d+)x\d+/.exec(base) || [])[1]) || 44;
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch {
    return null;
  }
  let best = null;
  for (const f of files) {
    const n = f.toLowerCase();
    if (!n.startsWith(`${base}.`) || !n.endsWith(ext)) continue;
    if (/contrast|lightunplated|theme-light/.test(n)) continue;
    const target = /targetsize-(\d+)/.exec(n);
    const scale = /scale-(\d+)/.exec(n);
    const size = target
      ? Number(target[1])
      : scale
        ? (nominal * Number(scale[1])) / 100
        : nominal;
    const unplated = n.includes("altform-unplated");
    const score = Math.abs(Math.log2(size / 64)) - (unplated ? 0.6 : 0);
    if (!best || score < best.score)
      best = { file: path.join(dir, f), unplated, score };
  }
  return best;
}

function storeIconFrom(installDir, appKey) {
  if (!installDir) return null;
  let manifest;
  try {
    manifest = fs.readFileSync(
      path.join(installDir, "AppxManifest.xml"),
      "utf8",
    );
  } catch {
    return null;
  }
  const ve = visualElementsFor(manifest, appKey);
  if (!ve) return null;
  for (const name of [
    "Square44x44Logo",
    "Square150x150Logo",
    "Square71x71Logo",
    "Logo",
  ]) {
    const rel = attrOf(ve, name);
    if (!rel) continue;
    const logo = pickLogo(installDir, rel);
    if (!logo) continue;
    const bytes = fs.readFileSync(logo.file);
    const mime = /\.jpe?g$/i.test(logo.file) ? "image/jpeg" : "image/png";
    // Varian bertipe "plated" butuh alas warna dari manifest agar terlihat seperti di Start
    const bgAttr = attrOf(ve, "BackgroundColor");
    const bg =
      !logo.unplated && bgAttr && !/^transparent$/i.test(bgAttr)
        ? bgAttr
        : undefined;
    return { url: `data:${mime};base64,${bytes.toString("base64")}`, bg };
  }
  return null;
}
// </pure-helpers>

// Electron TIDAK membaca isi file .lnk (ikonnya selalu kertas + panah). Jadi baca dulu
// target shortcut-nya, lalu ambil ikon dari file .exe/.ico aslinya.
async function shortcutIcon(lnk) {
  let link = null;
  try {
    link = shell.readShortcutLink(lnk);
  } catch {
    // shortcut rusak / tipe khusus
  }
  const candidates = [];
  if (
    link &&
    link.icon &&
    !link.iconIndex &&
    /\.(exe|ico|dll)$/i.test(link.icon)
  ) {
    candidates.push(expandEnv(link.icon));
  }
  if (link && link.target) candidates.push(expandEnv(link.target));
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    try {
      const img = await app.getFileIcon(c, { size: "large" });
      if (!img.isEmpty()) return { url: img.toDataURL() };
    } catch {
      // coba kandidat berikutnya
    }
  }
  return null;
}

// ---------- Indeks aplikasi ----------

function startMenuDirs() {
  const dirs = [];
  if (process.env.ProgramData) {
    dirs.push(
      path.join(
        process.env.ProgramData,
        "Microsoft",
        "Windows",
        "Start Menu",
        "Programs",
      ),
    );
  }
  if (process.env.APPDATA) {
    dirs.push(
      path.join(
        process.env.APPDATA,
        "Microsoft",
        "Windows",
        "Start Menu",
        "Programs",
      ),
    );
  }
  return dirs;
}

function walk(dir, depth = 0, out = []) {
  if (depth > 4) return out;
  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) walk(full, depth + 1, out);
    else if (it.isFile() && it.name.toLowerCase().endsWith(".lnk"))
      out.push(full);
  }
  return out;
}

// Satu kali jalan PowerShell untuk dua hal sekaligus:
// - Get-StartApps: semua aplikasi di Start (termasuk aplikasi Microsoft Store)
// - Get-AppxPackage: lokasi folder paket Store, tempat logo aplikasinya berada
function readStartInfo() {
  return new Promise((resolve) => {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8",
      "$apps=@(Get-StartApps | Select-Object Name,AppID)",
      "$pkgs=@(Get-AppxPackage | Select-Object PackageFamilyName,InstallLocation)",
      "@{apps=$apps;pkgs=$pkgs} | ConvertTo-Json -Compress -Depth 3",
    ].join("; ");
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      { windowsHide: true, timeout: 30000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        const empty = { apps: [], pkgs: [] };
        if (err) {
          console.warn("[launcher] PowerShell gagal:", err.message);
          return resolve(empty);
        }
        try {
          const text = String(stdout)
            .replace(/^\uFEFF/, "")
            .trim();
          const data = JSON.parse(text || "{}");
          const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
          resolve({ apps: list(data.apps), pkgs: list(data.pkgs) });
        } catch (e) {
          console.warn(
            "[launcher] output PowerShell tidak terbaca:",
            e.message,
          );
          resolve(empty);
        }
      },
    );
  });
}

async function buildIndex() {
  const next = new Map();
  if (IS_WIN) {
    const seen = new Set();
    const add = (e) => {
      const key = e.name.toLowerCase();
      if (!e.name || SKIP.test(e.name) || seen.has(key)) return;
      seen.add(key);
      next.set(e.id, e);
    };

    // 1) Shortcut Start Menu
    for (const dir of startMenuDirs()) {
      for (const file of walk(dir)) {
        add({
          id: `lnk:${file}`,
          name: path.basename(file, ".lnk"),
          kind: "desktop",
          path: file,
        });
      }
    }

    // 2) Aplikasi Microsoft Store (AppID berbentuk "NamaPaket_hash!IdApp"). Nama yang sudah ada dilewati.
    const info = await readStartInfo();
    const installByFamily = new Map();
    for (const p of info.pkgs) {
      if (p && p.PackageFamilyName && p.InstallLocation) {
        installByFamily.set(
          String(p.PackageFamilyName).toLowerCase(),
          String(p.InstallLocation),
        );
      }
    }
    for (const a of info.apps) {
      const appId = a && a.AppID ? String(a.AppID) : "";
      if (!a || !a.Name || !appId.includes("!")) continue;
      const [family, appKey] = appId.split("!");
      add({
        id: `store:${appId}`,
        name: String(a.Name),
        kind: "store",
        appId,
        appKey,
        installDir: installByFamily.get(family.toLowerCase()),
      });
    }
  }
  entries = next;
  builtAt = Date.now();
}

let rebuilding = false;
async function rebuild() {
  if (rebuilding) return;
  rebuilding = true;
  try {
    await buildIndex();
  } catch (e) {
    console.error("[launcher] gagal membangun indeks:", e);
  } finally {
    rebuilding = false;
  }
}

// Pemanggilan pertama membangun indeks; selanjutnya cukup menunggu promise yang sama.
let firstBuild = null;
const ensureIndex = () => (firstBuild ||= rebuild());

// ---------- IPC ----------

// Daftar ringan (tanpa ikon). Pencarian dilakukan di renderer supaya terasa instan.
ipcMain.handle("apps:list", async () => {
  await ensureIndex();
  if (Date.now() - builtAt > REINDEX_AFTER_MS) rebuild(); // segarkan di belakang layar, tanpa menunggu
  return [...entries.values()]
    .map(({ id, name, kind }) => ({ id, name, kind }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

// Ikon diminta per item (hanya yang tampil), lalu di-cache. Hasil: { url, bg? } atau null.
ipcMain.handle("apps:icon", async (_event, id) => {
  if (iconCache.has(id)) return iconCache.get(id);
  const entry = entries.get(id);
  let result = null;
  try {
    if (entry && entry.kind === "desktop")
      result = await shortcutIcon(entry.path);
    else if (entry && entry.kind === "store")
      result = storeIconFrom(entry.installDir, entry.appKey);
  } catch (e) {
    console.warn("[launcher] ikon gagal untuk", entry && entry.name, e.message);
  }
  iconCache.set(id, result); // null = pakai avatar huruf di renderer
  return result;
});

// Renderer hanya mengirim id. Yang dijalankan selalu entri dari indeks kita sendiri,
// bukan path/perintah dari renderer.
ipcMain.handle("apps:launch", async (_event, id) => {
  const entry = entries.get(id);
  if (!entry) return false;
  try {
    if (entry.kind === "store") {
      spawn("explorer.exe", [`shell:AppsFolder\\${entry.appId}`], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
      return true;
    }
    const err = await shell.openPath(entry.path);
    return !err;
  } catch (e) {
    console.error("[apps:launch]", e);
    return false;
  }
});

// Panaskan indeks begitu app siap, supaya pencarian pertama tidak menunggu
app.whenReady().then(() => ensureIndex());
