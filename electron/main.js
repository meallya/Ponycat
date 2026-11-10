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
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function placeWindow() {
  if (!win) return;
  const { x, y, width } = screen.getPrimaryDisplay().bounds;
  win.setBounds({
    x: Math.round(x + (width - WIN_W) / 2),
    y,
    width: WIN_W,
    height: WIN_H,
  });
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
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Tampilkan island",
        click: () => win && win.webContents.send("island:reveal"),
      },
      { type: "separator" },
      { label: "Keluar (Ctrl+Alt+Q)", click: () => app.quit() },
    ]),
  );
}

// ---------- IPC ----------

// Renderer memberi tahu kapan klik harus tembus dan kapan harus ditangkap
ipcMain.on("island:ignore-mouse", (_event, ignore) => {
  if (!win) return;
  win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
});

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

app.whenReady().then(() => {
  createWindow();
  createTray();
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
  media.start();
  notifs.start();

  // Monitor dicolok/dicabut atau resolusi berubah: posisikan ulang
  screen.on("display-metrics-changed", placeWindow);
  screen.on("display-added", placeWindow);
  screen.on("display-removed", placeWindow);

  // Setelah laptop bangun dari sleep, posisi dan level always-on-top kadang reset
  powerMonitor.on("resume", () => {
    placeWindow();
    if (win) win.setAlwaysOnTop(true, "screen-saver");
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  media.stop();
  // Bersihkan file sementara
  clearTemp();
});
