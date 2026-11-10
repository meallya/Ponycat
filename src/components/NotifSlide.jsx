import { IconChat, IconClose } from './icons.jsx'

const SHOWN = 2

// Catatan: ini daftar notifikasi milik island sendiri (masih contoh).
// Membaca notifikasi Windows sungguhan butuh aplikasi yang dipaketkan, lihat README.
export default function NotifSlide({ items, onDismiss }) {
  if (items.length === 0) {
    return (
      <div className="empty">
        <IconChat size={22} />
        <div>Tidak ada notifikasi</div>
      </div>
    )
  }

  return (
    <div className="notifs">
      {items.slice(0, SHOWN).map((n) => (
        <div className="notif-item" key={n.id}>
          <div className="notif-icon">
            <IconChat />
          </div>
          <div className="meta">
            <div className="title">{n.title}</div>
            <div className="sub">{n.body}</div>
          </div>
          <button className="mini" aria-label="Hapus" onClick={() => onDismiss(n.id)}>
            <IconClose />
          </button>
        </div>
      ))}
      {items.length > SHOWN && <div className="more">+{items.length - SHOWN} lagi</div>}
    </div>
  )
}
