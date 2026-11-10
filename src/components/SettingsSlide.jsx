const SIZES = [
  { id: 's', label: 'Kecil', hint: 'Compact', scale: 0.85 },
  { id: 'm', label: 'Sedang', hint: 'Default', scale: 1 },
  { id: 'l', label: 'Besar', hint: 'Expanded', scale: 1.15 },
]

const COLORS = [
  { id: 'pink', label: 'Pink', value: '#ff6bd6' },
  { id: 'blue', label: 'Biru', value: '#0a84ff' },
  { id: 'green', label: 'Hijau', value: '#30d158' },
  { id: 'orange', label: 'Oranye', value: '#ff9f0a' },
  { id: 'purple', label: 'Ungu', value: '#bf5af2' },
  { id: 'white', label: 'Putih', value: '#f5f5f7' },
]

const MENU_OPTS = [
  { id: 'music', label: 'Musik', hint: 'Kontrol & lirik' },
  { id: 'timer', label: 'Timer', hint: 'Hitung mundur' },
  { id: 'notif', label: 'Notifikasi', hint: 'Gmail · WA · Telegram' },
  { id: 'list', label: 'List', hint: 'Todo list' },
  { id: 'notes', label: 'Notes', hint: 'Catatan cepat' },
  { id: 'clock', label: 'Waktu', hint: 'Tanggal & jam' },
  { id: 'prayer', label: 'Prayer', hint: 'Jadwal sholat' },
  { id: 'temp', label: 'Sementara', hint: 'File & gambar' },
]

function Check({ on }) {
  return (
    <span className={`set-check ${on ? 'on' : ''}`}>
      {on ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : null}
    </span>
  )
}

export default function SettingsSlide({ settings, onChange }) {
  const toggleMenu = (id) => {
    const menus = settings.menus.includes(id)
      ? settings.menus.filter((m) => m !== id)
      : [...settings.menus, id]
    if (menus.length === 0) return
    onChange({ ...settings, menus })
  }

  return (
    <div className="settings-glass">
      {/* Ukuran */}
      <div className="set-group">
        <div className="set-group-title">Ukuran notch</div>
        <div className="set-list">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`set-row ${settings.size === s.id ? 'on' : ''}`}
              onClick={() => onChange({ ...settings, size: s.id, scale: s.scale })}
            >
              <span className="set-row-icon size-icon">{s.id.toUpperCase()}</span>
              <span className="set-row-text">
                <span className="set-row-label">{s.label}</span>
                <span className="set-row-hint">{s.hint}</span>
              </span>
              <Check on={settings.size === s.id} />
            </button>
          ))}
        </div>
      </div>

      {/* Warna */}
      <div className="set-group">
        <div className="set-group-title">Warna aksen</div>
        <div className="set-list set-list-colors">
          <div className="set-color-row">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`set-color ${settings.accent === c.value ? 'on' : ''}`}
                style={{ ['--c']: c.value }}
                title={c.label}
                aria-label={c.label}
                onClick={() => onChange({ ...settings, accent: c.value })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="set-group">
        <div className="set-group-title">Menu tampil</div>
        <div className="set-list">
          {MENU_OPTS.map((m) => {
            const on = settings.menus.includes(m.id)
            return (
              <button key={m.id} type="button" className={`set-row ${on ? 'on' : ''}`} onClick={() => toggleMenu(m.id)}>
                <span className="set-row-icon menu-icon">{m.label.slice(0, 1)}</span>
                <span className="set-row-text">
                  <span className="set-row-label">{m.label}</span>
                  <span className="set-row-hint">{m.hint}</span>
                </span>
                <Check on={on} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
