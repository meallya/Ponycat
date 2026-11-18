"use strict";
// Kompas: membaca sensor kompas Windows (Windows.Devices.Sensors.Compass) lewat PowerShell.
// Helper HANYA berjalan selama slide Kompas dibuka (renderer memanggil compass:start / compass:stop),
// jadi tidak ada proses latar tambahan saat slide lain yang tampil.
//
// Kebanyakan PC desktop dan laptop tidak punya sensor kompas. Kalau begitu helper melapor
// "no_sensor" sekali, hasilnya diingat, dan slide tetap menampilkan arah kiblat dari utara.
//
// Mode demo (tanpa sensor, untuk mencoba tampilan): ISLAND_DEMO_COMPASS=1
//
// Di main.js cukup satu baris: require("./compass");

const { app, ipcMain, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const readline = require("readline");

const IS_WIN = process.platform === "win32";
const DEMO = process.env.ISLAND_DEMO_COMPASS === "1";
const STOP_DELAY_MS = 3000; // jeda sebelum helper dimatikan, supaya pindah-pindah slide tidak membuat proses bolak-balik

let proc = null;
let demoTimer = null;
let last = null; // pesan terakhir: { ok, heading?, accuracy?, error? }
let unavailable = null; // hasil permanen "tidak ada sensor", supaya helper tidak dijalankan ulang
let stopTimer = null;

function broadcast(data) {
  last = data;
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed() && !w.webContents.isDestroyed()) {
      w.webContents.send("compass:update", data);
    }
  }
}

// ---------- Windows: baca sensor lewat PowerShell ----------

function spawnHelper() {
  // Kalau dipaketkan, compass.ps1 harus ada di luar asar (asarUnpack: "electron/*.ps1" sudah mencakupnya)
  const script = path
    .join(__dirname, "compass.ps1")
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
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  proc = p;

  const rl = readline.createInterface({ input: p.stdout });
  rl.on("line", (raw) => {
    const line = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    try {
      const data = JSON.parse(line);
      if (
        data &&
        data.ok === false &&
        (data.error === "no_sensor" || data.error === "api_unavailable")
      ) {
        unavailable = data;
      }
      broadcast(data);
    } catch {
      // baris bukan JSON, abaikan
    }
  });

  p.stderr.on("data", (d) => console.error("[compass]", String(d).trim()));
  p.stdin.on("error", () => {});

  // Tidak dijalankan ulang otomatis (tidak ada loop restart). Slide memanggil start lagi
  // saat dibuka kembali.
  p.on("exit", () => {
    if (proc === p) proc = null;
    if (!p.killedByUs && !unavailable) {
      broadcast({ ok: false, error: "helper_exit" });
    }
  });
}

// ---------- Mode demo: arah berputar pelan untuk mencoba tampilan ----------

function startDemo() {
  console.log("[compass] mode demo aktif");
  let h = 40;
  let t = 0;
  demoTimer = setInterval(() => {
    t += 0.1;
    h = (h + 0.9 + Math.sin(t) * 0.4 + 360) % 360;
    broadcast({
      ok: true,
      heading: Math.round(h * 10) / 10,
      accuracy: "high",
      demo: true,
    });
  }, 100);
}

// ---------- Umum ----------

function start() {
  clearTimeout(stopTimer);
  if (unavailable || proc || demoTimer) return;
  if (DEMO) return startDemo();
  if (!IS_WIN) {
    unavailable = { ok: false, error: "api_unavailable" };
    broadcast(unavailable);
    return;
  }
  spawnHelper();
}

function killNow() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
  }
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
  if (!unavailable) last = null; // jangan kirim arah lama saat slide dibuka lagi
}

ipcMain.handle("compass:start", () => {
  start();
  return unavailable || last;
});

ipcMain.on("compass:stop", () => {
  clearTimeout(stopTimer);
  stopTimer = setTimeout(killNow, STOP_DELAY_MS);
});

app.on("will-quit", killNow);
