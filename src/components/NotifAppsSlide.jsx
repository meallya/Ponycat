import { IconGmail, IconWA, IconTG, IconClose, IconMenuMail } from './icons.jsx'

const APPS = {
  gmail: { name: 'Gmail / Mail', Icon: IconGmail },
  whatsapp: { name: 'WhatsApp', Icon: IconWA },
  telegram: { name: 'Telegram', Icon: IconTG },
  other: { name: 'Lainnya', Icon: IconMenuMail },
}

export default function NotifAppsSlide({ items, meta, onDismiss, onClear }) {
  if (meta && meta.ok === false && meta.error === 'access_denied') {
    return (
      <div className="empty">
        <div>Akses notifikasi belum diizinkan</div>
        <small>
          Buka Settings → Privacy & security → Notifications → biarkan app ini membaca notifikasi
        </small>
      </div>
    )
  }

  if (meta && meta.ok === false && meta.error === 'api_unavailable') {
    return (
      <div className="empty">
        <div>API notifikasi tidak tersedia</div>
        <small>Butuh Windows 10 versi terbaru</small>
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="empty">
        <div>Tidak ada notifikasi</div>
        <small>Notifikasi Gmail, WhatsApp, Telegram, dan toast lain akan muncul di sini</small>
      </div>
    )
  }

  return (
    <div className="notif-apps">
      <div className="notif-apps-head">
        <span>{items.length} notifikasi</span>
        <button type="button" className="temp-clear" onClick={onClear}>
          Hapus semua
        </button>
      </div>
      <div className="notif-apps-list">
        {items.map((n) => {
          const app = APPS[n.app] || APPS.other
          const Icon = app.Icon
          return (
            <div className="notif-app-item" key={n.id}>
              <div className="notif-app-icon">
                <Icon size={18} />
              </div>
              <div className="meta">
                <div className="title">
                  {n.appName || app.name}
                  {n.from ? <span className="notif-app-from"> · {n.from}</span> : null}
                </div>
                <div className="sub">{n.body || '—'}</div>
              </div>
              <button type="button" className="mini" aria-label="Hapus" onClick={() => onDismiss(n.id)}>
                <IconClose />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
