export default function NotifView() {
  return (
    <div className="notif">
      <div className="notif-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        </svg>
      </div>
      <div className="notif-text">
        <div className="title">Pesan baru</div>
        <div className="artist">Dynamic Island kamu sudah jalan</div>
      </div>
    </div>
  )
}
