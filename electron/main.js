const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  screen,
  ipcMain,
  globalShortcut,
  nativeImage,
  powerMonitor,
} = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { MediaBridge } = require("./media");
const { NotifBridge } = require("./notifs");
require("./launcher"); // pencarian & peluncur aplikasi
const { registerConvert } = require("./convert"); // konversi file & gambar

const isDev = process.env.DEV === "1";

// Window dibuat lebih besar dari pill-nya. Yang dianimasikan cuma pill di dalamnya,
// sisanya transparan dan click-through.
const WIN_W = 680;
const WIN_H = 270;

let win = null;
let tray = null;
const media = new MediaBridge();
const notifs = new NotifBridge();

// Cuma boleh ada satu instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Dibuka otomatis oleh Windows saat login (lihat setLoginItemSettings di bawah)
const launchedAtLogin =
  process.argv.includes("--autostart") ||
  (process.platform === "win32" && app.getLoginItemSettings().wasOpenedAtLogin);

// ---------- Preferensi kecil (disimpan di folder data aplikasi) ----------

const prefsFile = () => path.join(app.getPath("userData"), "prefs.json");

function loadPrefs() {
  try {
    return JSON.parse(fs.readFileSync(prefsFile(), "utf8"));
  } catch {
    return {};
  }
}

function savePrefs(patch) {
  try {
    const next = { ...loadPrefs(), ...patch };
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(prefsFile(), JSON.stringify(next), "utf8");
  } catch (e) {
    console.warn("[prefs] gagal menyimpan:", e.message);
  }
}

// ---------- Auto-start saat Windows menyala (seperti Laragon) ----------

// Hanya berlaku untuk build terpasang. Saat `npm run dev` jangan mendaftarkan apa pun.
function autostartSupported() {
  return process.platform === "win32" && app.isPackaged;
}

function autostartEnabled() {
  // Default: aktif. Pengguna bisa mematikannya lewat menu tray.
  return loadPrefs().autostart !== false;
}

function applyAutostart() {
  if (!autostartSupported()) return;
  try {
    app.setLoginItemSettings({
      openAtLogin: autostartEnabled(),
      args: ["--autostart"],
    });
  } catch (e) {
    console.warn("[autostart]", e.message);
  }
}

function placeWindow() {
  if (!win || win.isDestroyed()) return;
  const { x, y, width } = screen.getPrimaryDisplay().bounds;
  win.setBounds({
    x: Math.round(x + (width - WIN_W) / 2),
    y,
    width: WIN_W,
    height: WIN_H,
  });
}

// ---------- Hit-test kursor di main process ----------
//
// Sebelumnya klik-tembus diatur renderer lewat event mouse yang "diteruskan"
// (setIgnoreMouseEvents + forward). Di Windows event itu bisa berhenti datang setelah
// berjam-jam (atau setelah sleep/lock), dan akibatnya menu notch tidak bisa diklik.
// Sekarang main process yang membaca posisi kursor sendiri dan menentukan:
//   - klik ditangkap hanya kalau kursor benar-benar di atas notch,
//   - di luar notch klik selalu tembus ke aplikasi di bawahnya,
//   - renderer diberi tahu status hover / zona atas dari sini, bukan dari event DOM.
const HIT_PAD = 4; // toleransi di sekeliling notch (px)
const ZONE_W = 280; // lebar zona pemicu di tepi atas layar (sama dengan .hotzone)
const ZONE_H = 14;

let islandRect = { w: 128, h: 34, y: 0, hidden: false };
let cursorTimer = null;
let lastIgnore = null;
let lastHover = false;
let lastZone = false;
let beats = 0;

function setIgnore(ignore) {
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(ignore, { forward: true });
  lastIgnore = ignore;
}

function cursorTick() {
  if (!win || win.isDestroyed()) return;
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  const lx = p.x - b.x;
  const ly = p.y - b.y;

  const half = islandRect.w / 2 + HIT_PAD;
  const cx = WIN_W / 2;
  const inside =
    !islandRect.hidden &&
    lx >= cx - half &&
    lx <= cx + half &&
    ly >= 0 &&
    ly <= islandRect.h + islandRect.y + HIT_PAD;
  const zone =
    ly >= 0 && ly <= ZONE_H && lx >= cx - ZONE_W / 2 && lx <= cx + ZONE_W / 2;

  // Tulis ulang status ignore tiap ~2 detik: kalau Windows sempat melupakannya, pulih sendiri.
  beats = (beats + 1) % 40;
  // Zona atas hanya memicu buka lewat posisi kursor; tidak perlu menangkap klik,
  // jadi tombol jendela di pojok atas aplikasi lain tetap bisa diklik.
  const ignore = !inside;
  if (ignore !== lastIgnore || beats === 0) setIgnore(ignore);

  if (inside !== lastHover || zone !== lastZone || beats === 0) {
    lastHover = inside;
    lastZone = zone;
    if (win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send("island:cursor", { hover: inside, zone });
    }
  }
}

function startCursorWatch() {
  stopCursorWatch();
  lastIgnore = null;
  cursorTimer = setInterval(cursorTick, 50);
}

function stopCursorWatch() {
  if (cursorTimer) clearInterval(cursorTimer);
  cursorTimer = null;
}

// Pulihkan semua yang bisa "lupa" setelah sleep, lock layar, atau ganti monitor
function healWindow() {
  if (!win || win.isDestroyed()) return;
  placeWindow();
  win.setAlwaysOnTop(true, "screen-saver");
  if (!win.isVisible()) win.showInactive();
  lastIgnore = null;
  lastHover = false;
  lastZone = false;
}

function createWindow() {
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Penting untuk kehalusan: window yang tidak fokus tidak boleh di-throttle,
      // kalau tidak animasi jadi patah-patah.
      backgroundThrottling: false,
      webSecurity: false,
    },
  });

  // 'screen-saver' = level paling tinggi, tetap di atas sebagian besar window
  win.setAlwaysOnTop(true, "screen-saver");
  // Default: semua klik tembus ke aplikasi di bawahnya. Renderer yang menyalakan
  // klik lagi saat mouse masuk ke area pill.
  win.setIgnoreMouseEvents(true, { forward: true });
  placeWindow();

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.once("ready-to-show", () => win.showInactive());

  // Window hanya boleh fokus saat mengetik di slide Notes. Begitu kehilangan fokus,
  // kembali ke mode tidak-bisa-fokus supaya tidak mencuri fokus dari aplikasi lain.
  win.on("blur", () => {
    if (win && win.isFocusable()) {
      win.setFocusable(false);
      win.setAlwaysOnTop(true, "screen-saver");
    }
  });

  // Kalau renderer macet atau crash (mis. setelah dipakai berjam-jam), muat ulang
  // otomatis daripada membiarkan notch beku.
  const reload = () => {
    if (!win || win.isDestroyed()) return;
    console.warn("[window] renderer bermasalah, memuat ulang");
    lastHover = false;
    lastZone = false;
    win.webContents.reload();
  };
  let stuck = false;
  win.webContents.on("render-process-gone", () => setTimeout(reload, 500));
  win.webContents.on("unresponsive", () => {
    stuck = true;
    setTimeout(() => stuck && reload(), 8000);
  });
  win.webContents.on("responsive", () => {
    stuck = false;
  });
  win.webContents.on("did-finish-load", () => {
    // Setelah dimuat ulang, kirim lagi status kursor terkini
    lastHover = !lastHover;
    lastZone = !lastZone;
  });
}

// Pill kecil 16x16 (format BGRA) yang digambar langsung. Dipakai kalau ikon ucing tidak ketemu.
function drawnTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 5; y <= 10; y++) {
    for (let x = 1; x <= 14; x++) {
      const corner = (x === 1 || x === 14) && (y === 5 || y === 10);
      if (corner) continue;
      const i = (y * size + x) * 4;
      buf[i] = 0xff; // B
      buf[i + 1] = 0x8c; // G
      buf[i + 2] = 0x7c; // R
      buf[i + 3] = 0xff; // A
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

// Ikon tray = ucing dari build/icon.png. Setelah dipaketkan, file ini disalin ke folder
// resources lewat "extraResources" di package.json (lihat catatan build).
function trayIcon() {
  try {
    const file = app.isPackaged
      ? path.join(process.resourcesPath, "icon.png")
      : path.join(__dirname, "..", "build", "icon.png");
    const src = nativeImage.createFromPath(file);
    if (src.isEmpty()) return drawnTrayIcon();
    const base = process.platform === "linux" ? 24 : 16;
    const png = (px) =>
      src.resize({ width: px, height: px, quality: "best" }).toPNG();
    // 1x untuk layar biasa, 2x untuk layar HiDPI supaya tetap tajam
    const img = nativeImage.createEmpty();
    img.addRepresentation({
      scaleFactor: 1,
      width: base,
      height: base,
      buffer: png(base),
    });
    img.addRepresentation({
      scaleFactor: 2,
      width: base * 2,
      height: base * 2,
      buffer: png(base * 2),
    });
    return img;
  } catch (e) {
    console.warn("[tray] ikon ucing gagal dimuat:", e.message);
    return drawnTrayIcon();
  }
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("Ponycat");
  const items = [
    {
      label: "Tampilkan island",
      click: () => win && win.webContents.send("island:reveal"),
    },
  ];
  if (autostartSupported()) {
    items.push({
      label: "Jalankan saat Windows menyala",
      type: "checkbox",
      checked: autostartEnabled(),
      click: (item) => {
        savePrefs({ autostart: item.checked });
        applyAutostart();
      },
    });
  }
  items.push(
    { type: "separator" },
    { label: "Keluar (Ctrl+Alt+Q)", click: () => app.quit() },
  );
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

// Saat Windows baru menyala, taskbar (tempat ikon tray) kadang belum siap dan Tray gagal dibuat.
// Coba lagi beberapa kali sampai berhasil.
function createTrayWithRetry(attempt = 0) {
  try {
    createTray();
  } catch (e) {
    console.warn(`[tray] gagal (percobaan ${attempt + 1}):`, e.message);
    tray = null;
    if (attempt < 12) setTimeout(() => createTrayWithRetry(attempt + 1), 5000);
  }
}

// ---------- IPC ----------

// Renderer melaporkan ukuran notch yang sedang dituju, dipakai hit-test kursor di atas.
// (Klik tembus sekarang diatur main process, bukan lagi lewat "island:ignore-mouse".)
ipcMain.on("island:bounds", (_event, r) => {
  if (!r || typeof r !== "object") return;
  const w = Number(r.w);
  const h = Number(r.h);
  if (!(w > 0 && h > 0)) return;
  islandRect = {
    w: Math.min(w, WIN_W),
    h: Math.min(h, WIN_H),
    y: Number(r.y) || 0,
    hidden: Boolean(r.hidden),
  };
});

// Dipertahankan supaya preload lama tidak error; tidak melakukan apa pun.
ipcMain.on("island:ignore-mouse", () => {});

// Dipakai slide Notes: window dibuat bisa fokus supaya keyboard berfungsi
ipcMain.handle("island:focusable", (_event, focusable) => {
  if (!win) return false;
  win.setFocusable(Boolean(focusable));
  if (focusable) win.focus();
  win.setAlwaysOnTop(true, "screen-saver");
  return true;
});

ipcMain.handle("media:get", () => media.last);
ipcMain.on("media:command", (_event, cmd) => media.command(cmd));

ipcMain.handle("notifs:get", () => notifs.last);
ipcMain.on("notifs:command", (_event, cmd) => notifs.command(cmd));
ipcMain.handle("todos:load", () => {
  try {
    const p = path.join(app.getPath("userData"), "todos.json");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  } catch {}
  return "[]";
});
ipcMain.on("todos:save", (_event, text) => {
  try {
    const p = path.join(app.getPath("userData"), "todos.json");
    fs.writeFileSync(p, String(text ?? "[]"), "utf8");
  } catch (e) {
    console.error("[todos:save]", e);
  }
});

const notesFile = () => path.join(app.getPath("userData"), "notes.json");
ipcMain.handle("notes:load", () => {
  try {
    return fs.readFileSync(notesFile(), "utf8");
  } catch {
    // migrasi dari format lama notes.txt
    try {
      const old = fs.readFileSync(
        path.join(app.getPath("userData"), "notes.txt"),
        "utf8",
      );
      return old;
    } catch {
      return "[]";
    }
  }
});
ipcMain.on("notes:save", (_event, text) => {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFile(notesFile(), String(text ?? "[]"), () => {});
  } catch {
    // gagal menyimpan, abaikan
  }
});

// Penyimpanan file sementara (hapus saat app keluar)
const tempDir = () => path.join(app.getPath("temp"), "dynamic-island-temp");
// startDrag WAJIB punya ikon yang tidak kosong, jadi ikonnya disimpan saat file masuk
const tempIcons = new Map(); // path -> NativeImage

const insideTemp = (p) =>
  typeof p === "string" && path.resolve(p).startsWith(tempDir() + path.sep);

// Satu subfolder unik per item: nama file asli tetap utuh saat dijatuhkan ke
// Desktop/folder (tanpa awalan timestamp) dan tidak bentrok antar item.
function tempSlot(name) {
  const dir = path.join(tempDir(), crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  const safe = String(name || "file").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  return path.join(dir, safe);
}

async function rememberIcon(dest) {
  try {
    tempIcons.set(dest, await app.getFileIcon(dest));
  } catch (e) {
    console.error("[temp:icon]", e);
  }
}

function dirSize(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  return fs
    .readdirSync(p)
    .reduce((sum, n) => sum + dirSize(path.join(p, n)), 0);
}

function clearTemp() {
  try {
    fs.rmSync(tempDir(), { recursive: true, force: true });
  } catch {
    // ignore
  }
  tempIcons.clear();
}

// Cara lama: renderer mengirim byte file (tidak bisa untuk folder)
ipcMain.handle("temp:save", async (_event, name, bytes) => {
  try {
    const dest = tempSlot(name);
    fs.writeFileSync(dest, Buffer.from(bytes));
    await rememberIcon(dest);
    return dest;
  } catch {
    return null;
  }
});

// Cara baru: renderer mengirim path asli, main yang menyalin (file ATAU folder)
ipcMain.handle("temp:add-path", async (_event, src) => {
  try {
    const st = fs.statSync(src);
    const dest = tempSlot(path.basename(src));
    fs.cpSync(src, dest, { recursive: true });
    await rememberIcon(dest);
    return { path: dest, isDir: st.isDirectory(), size: dirSize(dest) };
  } catch (e) {
    console.error("[temp:add-path]", e);
    return null;
  }
});

// Hapus satu item (beserta subfolder uniknya)
ipcMain.handle("temp:remove", (_event, filePath) => {
  try {
    if (!insideTemp(filePath)) return;
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    tempIcons.delete(filePath);
  } catch {
    // ignore
  }
});

ipcMain.handle("temp:clear", () => clearTemp());

// Drag file keluar dari island ke aplikasi lain (Explorer, browser, chat, dll)
ipcMain.on("temp:start-drag", (event, filePath) => {
  try {
    if (!insideTemp(filePath) || !fs.existsSync(filePath)) return;
    let icon = tempIcons.get(filePath);
    if (!icon || icon.isEmpty()) icon = nativeImage.createFromPath(filePath);
    if (icon.isEmpty())
      console.warn("[temp:start-drag] ikon kosong, drag mungkin gagal");
    event.sender.startDrag({ file: filePath, icon });
  } catch (e) {
    console.error("[temp:start-drag]", e);
  }
});

// Konversi file & gambar (IPC: convert:probe, convert:run, ...)
registerConvert({ getWin: () => win });

// ---------- Lifecycle ----------

app.on("second-instance", () => {
  // Dibuka lagi saat sudah berjalan: cukup munculkan notch
  if (win && !win.isDestroyed()) win.webContents.send("island:reveal");
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Saat login, Windows masih sibuk memuat desktop, taskbar, dan layar. Beri jeda dan tunggu
// layar utama siap supaya notch tidak muncul setengah jadi atau di posisi salah.
async function waitForDesktop() {
  await sleep(3000);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const b = screen.getPrimaryDisplay()?.bounds;
    if (b && b.width > 0 && b.height > 0) return;
    await sleep(500);
  }
}

if (gotLock)
  app.whenReady().then(async () => {
    applyAutostart();
    if (launchedAtLogin) await waitForDesktop();

    createWindow();
    createTrayWithRetry();
    startCursorWatch();
    globalShortcut.register("Control+Alt+Q", () => app.quit());

    // Pintasan global: buka island langsung ke pencarian aplikasi
    const searchKey = "Control+Alt+Space";
    const searchKeyOk = globalShortcut.register(searchKey, () => {
      if (!win || win.isDestroyed()) return;
      win.webContents.send("island:open-search"); // Island.jsx: buka, pindah ke slide pencarian, fokus
    });
    if (!searchKeyOk)
      console.warn(`[shortcut] ${searchKey} sudah dipakai aplikasi lain`);

    notifs.on("update", (data) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("notifs:update", data);
      }
    });
    media.on("update", (data) => {
      if (win && !win.isDestroyed()) win.webContents.send("media:update", data);
    });
    // Helper PowerShell cukup berat. Saat login, mulai setelah layar tenang supaya
    // tidak berebut CPU dengan proses boot lain (dan WinRT media sudah siap).
    setTimeout(
      () => {
        media.start();
        notifs.start();
      },
      launchedAtLogin ? 4000 : 0,
    );

    // Monitor dicolok/dicabut atau resolusi berubah: posisikan ulang
    screen.on("display-metrics-changed", healWindow);
    screen.on("display-added", healWindow);
    screen.on("display-removed", healWindow);

    // Setelah laptop bangun dari sleep atau layar dibuka dari lock, posisi, level
    // always-on-top, dan status klik-tembus kadang reset
    powerMonitor.on("resume", () => setTimeout(healWindow, 1000));
    powerMonitor.on("unlock-screen", () => setTimeout(healWindow, 500));

    // Saat boot, resolusi/DPI sering baru stabil beberapa detik kemudian
    if (launchedAtLogin) {
      for (const ms of [3000, 8000, 20000]) setTimeout(healWindow, ms);
    }
  });

app.on("will-quit", () => {
  stopCursorWatch();
  globalShortcut.unregisterAll();
  media.stop();
  notifs.stop();
  // Bersihkan file sementara
  clearTemp();
});
