const { spawn } = require("child_process");
const { EventEmitter } = require("events");
const path = require("path");
const readline = require("readline");

const COMMANDS = new Set([
  "play-pause",
  "next",
  "prev",
  "vol-up",
  "vol-down",
  "vol-mute",
]);

// Lagu contoh untuk mode demo (npm run demo)
const gradient = (a, b) =>
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>` +
      `</linearGradient></defs><rect width="200" height="200" fill="url(#g)"/></svg>`,
  ).toString("base64");

const DEMO_TRACKS = [
  {
    app: "Spotify.exe",
    title: "Midnight Coding",
    artist: "Lofi Station",
    album: "Night Shift",
    duration: 187,
    art: gradient("#7c8cff", "#ff6bd6"),
  },
  {
    app: "chrome.exe",
    title: "Kopi dan Hujan",
    artist: "Sore Hari",
    album: "Senja",
    duration: 214,
    art: gradient("#ff9f0a", "#ff375f"),
  },
  {
    app: "msedge.exe",
    title: "Deploy Jumat Malam",
    artist: "The Standups",
    album: "Sprint",
    duration: 156,
    art: gradient("#30d158", "#0a84ff"),
  },
];

// Menjalankan media.ps1 sebagai proses latar dan menjembataninya ke Electron.
// Hanya aktif di Windows (atau mode demo di OS apa pun).
class MediaBridge extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.last = null;
    this.stopped = false;
    this.restarts = 0;
    this.startedAt = 0;
    this.demo = null;
    this.demoTimers = [];
  }

  start() {
    this.stopped = false;
    if (process.env.ISLAND_DEMO_MEDIA === "1") return this.startDemo();
    if (process.platform !== "win32") {
      console.log("[media] bukan Windows, deteksi musik dimatikan");
      return;
    }
    this.spawnHelper();
  }

  // ---------- Windows: baca media session lewat PowerShell ----------

  spawnHelper() {
    // Kalau nanti dipaketkan, media.ps1 harus ada di luar asar (asarUnpack)
    const script = path
      .join(__dirname, "media.ps1")
      .replace("app.asar", "app.asar.unpacked");

    this.startedAt = Date.now();
    this.proc = spawn(
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

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on("line", (raw) => {
      // Buang BOM di awal baris kalau ada
      const line = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
      try {
        const data = JSON.parse(line);
        this.last = data;
        this.emit("update", data);
      } catch {
        // baris bukan JSON, abaikan
      }
    });

    this.proc.stderr.on("data", (d) =>
      console.error("[media]", String(d).trim()),
    );
    this.proc.stdin.on("error", () => {});

    // Helper mati (mis. Windows belum siap saat baru boot): jalankan lagi dengan jeda yang
    // makin panjang, tapi jangan pernah menyerah. Dulu berhenti setelah 5 kali gagal, jadi
    // kalau semuanya gagal di detik-detik awal boot, deteksi musik mati sampai app dibuka ulang.
    this.proc.on("exit", () => {
      this.proc = null;
      if (this.stopped) return;
      if (Date.now() - this.startedAt > 60000) this.restarts = 0; // sempat stabil
      this.restarts += 1;
      const delay = Math.min(2000 * 2 ** Math.min(this.restarts - 1, 4), 30000);
      setTimeout(() => {
        if (!this.stopped && !this.proc) this.spawnHelper();
      }, delay);
    });
  }

  // ---------- Mode demo: musik palsu untuk mencoba tampilan ----------

  startDemo() {
    console.log("[media] mode demo aktif");
    const demo = { i: 0, playing: true, pos: 0, at: Date.now() };
    this.demo = demo;

    const push = () => {
      const t = DEMO_TRACKS[demo.i];
      this.last = {
        hasSession: true,
        app: t.app,
        title: t.title,
        artist: t.artist,
        album: t.album,
        status: demo.playing ? "playing" : "paused",
        position: Math.round(demo.pos * 10) / 10,
        duration: t.duration,
        thumbnail: t.art,
      };
      this.emit("update", this.last);
    };
    const tick = () => {
      const now = Date.now();
      if (demo.playing) demo.pos += (now - demo.at) / 1000;
      demo.at = now;
    };

    this.demoPush = push;
    this.demoTick = tick;
    this.demoTimers.push(setTimeout(push, 2500)); // beri waktu window selesai dimuat
    this.demoTimers.push(
      setInterval(() => {
        tick();
        if (demo.playing && demo.pos >= DEMO_TRACKS[demo.i].duration) {
          demo.i = (demo.i + 1) % DEMO_TRACKS.length;
          demo.pos = 0;
          push();
        }
      }, 1000),
    );
  }

  commandDemo(cmd) {
    const demo = this.demo;
    if (!demo) return;
    this.demoTick();
    if (cmd === "play-pause") demo.playing = !demo.playing;
    if (cmd === "next" || cmd === "prev") {
      const n = DEMO_TRACKS.length;
      demo.i = (demo.i + (cmd === "next" ? 1 : n - 1)) % n;
      demo.pos = 0;
      demo.playing = true;
    }
    this.demoPush();
  }

  // ---------- Umum ----------

  command(cmd) {
    if (!COMMANDS.has(cmd)) return;
    if (this.demo) return this.commandDemo(cmd);
    if (!this.proc || !this.proc.stdin.writable) return;
    this.proc.stdin.write(`${cmd}\n`);
  }

  stop() {
    this.stopped = true;
    this.demoTimers.forEach((t) => {
      clearTimeout(t);
      clearInterval(t);
    });
    this.demoTimers = [];
    if (this.proc) {
      try {
        this.proc.stdin.end();
        this.proc.kill();
      } catch {
        // sudah mati
      }
      this.proc = null;
    }
  }
}

module.exports = { MediaBridge };
