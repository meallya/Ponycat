const { spawn } = require('child_process')
const { EventEmitter } = require('events')
const path = require('path')
const readline = require('readline')

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

  command(cmd) {
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
