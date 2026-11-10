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

    this.proc.on('exit', () => {
      this.proc = null
      if (!this.stopped && this.restarts < 5) {
        this.restarts += 1
        setTimeout(() => this.spawnHelper(), 3000)
      }
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
