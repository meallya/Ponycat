"use strict";
// Deteksi "aplikasi di depan" (Chrome, Explorer, dll.) lewat PowerShell + user32.
// Renderer memakainya agar notch terus terbuka saat desktop kosong dan menutup sendiri
// begitu ada aplikasi yang dipakai.
//
// Status yang dikirim ke renderer (channel "foreground:update", juga lewat "foreground:get"):
//   "desktop" = desktop kosong, "app" = ada aplikasi di depan,
//   null      = tidak diketahui (bukan Windows, helper gagal, atau dimatikan): renderer
//               kembali ke perilaku lama (buka saat kursor di atas notch, dst.)
//
// Mematikan fitur untuk sementara (mis. saat testing di terminal): ISLAND_AUTOOPEN=0
//
// Di main.js:
//   const foreground = require("./foreground");
//   ... di app.whenReady, sesudah createWindow():  foreground.start();

const { app, ipcMain, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const readline = require("readline");

const IS_WIN = process.platform === "win32";
const ENABLED = process.env.ISLAND_AUTOOPEN !== "0";

// "desktop" baru dikirim kalau bertahan selama jeda ini. Mencegah notch berkedip terbuka
// sesaat ketika fokus melewati taskbar/menu Start dalam perjalanan ke aplikasi lain.
// "app" dikirim seketika.
const DESKTOP_DELAY_MS = 450;
// Helper yang mati dijalankan ulang, dibatasi supaya tidak jadi loop tanpa akhir.
const RESTART_DELAY_MS = 4000;
const MAX_RESTARTS = 5;
const STABLE_MS = 60 * 1000; // helper yang hidup selama ini dianggap sehat: hitungan restart di-reset

let proc = null;
let state = null; // "app" | "desktop" | null
let pending = null; // timer jeda untuk "desktop"
let restartTimer = null;
let restarts = 0;
let quitting = false;

function broadcast() {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed() && !w.webContents.isDestroyed()) {
      w.webContents.send("foreground:update", state);
    }
  }
}

function commit(next) {
  if (next === state) return;
  state = next;
  broadcast();
}

function apply(next) {
  clearTimeout(pending);
  pending = null;
  if (next === state) return;
  if (next === "desktop") {
    pending = setTimeout(() => {
      pending = null;
      commit("desktop");
    }, DESKTOP_DELAY_MS);
  } else {
    commit(next);
  }
}

function spawnHelper() {
  // Kalau dipaketkan, foreground.ps1 harus ada di luar asar (asarUnpack: "electron/*.ps1" sudah mencakupnya)
  const script = path
    .join(__dirname, "foreground.ps1")
    .replace("app.asar", "app.asar.unpacked");

  const p = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-SelfPid",
      String(process.pid),
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  proc = p;
  const startedAt = Date.now();
  let fatal = false; // helper melapor tidak bisa jalan: jangan diulang

  const rl = readline.createInterface({ input: p.stdout });
  rl.on("line", (raw) => {
    const line = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    try {
      const data = JSON.parse(line);
      if (data && data.ok === false) {
        fatal = true;
        apply(null);
        return;
      }
      if (data && (data.state === "app" || data.state === "desktop")) {
        apply(data.state);
      }
    } catch {
      // baris bukan JSON, abaikan
    }
  });

  p.stderr.on("data", (d) => console.error("[foreground]", String(d).trim()));
  p.stdin.on("error", () => {});

  p.on("exit", () => {
    if (proc === p) proc = null;
    if (quitting || p.killedByUs || fatal) return;

    // Status tidak lagi bisa dipercaya: kembali ke perilaku lama sampai helper hidup lagi
    apply(null);
    if (Date.now() - startedAt > STABLE_MS) restarts = 0;
    if (restarts >= MAX_RESTARTS) {
      console.error("[foreground] helper berhenti terus, tidak dijalankan ulang");
      return;
    }
    restarts += 1;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!quitting && !proc) spawnHelper();
    }, RESTART_DELAY_MS);
  });
}

function start() {
  if (!ENABLED || !IS_WIN || proc || quitting) return;
  spawnHelper();
}

function stop() {
  quitting = true;
  clearTimeout(pending);
  clearTimeout(restartTimer);
  if (proc) {
    const p = proc;
    proc = null;
    p.killedByUs = true;
    try {
      p.stdin.end();
      p.kill();
    } catch {
      // sudah mati
    }
  }
}

ipcMain.handle("foreground:get", () => state);
app.on("will-quit", stop);

module.exports = { start, stop };
