const { spawn } = require('child_process')
const { EventEmitter } = require('events')
const path = require('path')
const readline = require('readline')

// Notifikasi contoh untuk mode demo (npm run demo): melihat tampilan slide Notifikasi
// tanpa izin Windows. Waktunya dibuat relatif terhadap sekarang.
const ago = (min) => new Date(Date.now() - min * 60000).toISOString()
const demoItems = () => [
  { id: 1, app: 'whatsapp', appName: 'WhatsApp', appId: 'demo.whatsapp', from: 'Aldi', body: 'Bro, jadi rapat jam 3?', time: ago(1) },
  { id: 2, app: 'telegram', appName: 'Telegram', appId: 'demo.telegram', from: 'Grup Kampus', body: 'Dosen: tugas dikumpul besok', time: ago(6) },
  { id: 3, app: 'gmail', appName: 'Gmail', appId: 'demo.gmail', from: 'GitHub', body: 'Run failed: Ponycat build #12', time: ago(14) },
  { id: 4, app: 'other', appName: 'Windows Security', appId: 'demo.other', from: 'Pembaruan selesai', body: 'Perangkat kamu sudah aman', time: ago(32) },
]

class NotifBridge extends EventEmitter {
  constructor() {
    super()
    this.proc = null
    this.last = { ok: false, items: [] }
    this.stopped = false
    this.restarts = 0
    this.startedAt = 0
  }

  start() {
    this.stopped = false
    if (process.env.ISLAND_DEMO_NOTIFS === '1') return this.startDemo()
    if (process.platform !== 'win32') {
      console.log('[notifs] hanya Windows')
      return
    }
    this.spawnHelper()
  }

  spawnHelper() {
    const script = path.join(__dirname, 'notifs.ps1').replace('app.asar', 'app.asar.unpacked')
    this.startedAt = Date.now()
    this.proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
    )

    const rl = readline.createInterface({ input: this.proc.stdout })
    rl.on('line', (raw) => {
      const line = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
      try {
        const data = JSON.parse(line)
        this.last = data
        this.emit('update', data)
      } catch {
        // ignore
      }
    })

    this.proc.stderr.on('data', (d) => console.error('[notifs]', String(d).trim()))
    this.proc.stdin.on('error', () => {})

    // Jalankan lagi dengan jeda yang makin panjang; jangan menyerah (lihat media.js)
    this.proc.on('exit', () => {
      this.proc = null
      if (this.stopped) return
      if (Date.now() - this.startedAt > 60000) this.restarts = 0
      this.restarts += 1
      const delay = Math.min(3000 * 2 ** Math.min(this.restarts - 1, 4), 30000)
      setTimeout(() => {
        if (!this.stopped && !this.proc) this.spawnHelper()
      }, delay)
    })
  }

  // ---------- Mode demo ----------

  startDemo() {
    console.log('[notifs] mode demo aktif')
    this.demo = demoItems()
    this.pushDemo()
    // Kirim lagi setelah window selesai dimuat
    setTimeout(() => this.pushDemo(), 2500)
  }

  pushDemo() {
    this.last = { ok: true, access: 'Allowed', items: this.demo }
    this.emit('update', this.last)
  }

  command(cmd) {
    if (this.demo) {
      const [name, arg] = String(cmd).trim().split(/\s+/, 2)
      if (name === 'clear') this.demo = []
      if (name === 'dismiss') this.demo = this.demo.filter((n) => String(n.id) !== arg)
      return this.pushDemo()
    }
    if (!this.proc?.stdin?.writable) return
    try {
      this.proc.stdin.write(String(cmd) + '\n')
    } catch {
      // ignore
    }
  }

  stop() {
    this.stopped = true
    if (this.proc) {
      try {
        this.proc.kill()
      } catch {
        // ignore
      }
      this.proc = null
    }
  }
}

module.exports = { NotifBridge }
