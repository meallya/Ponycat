import { useRef } from 'react'
import { IconPlus, IconTrash } from './icons.jsx'
import { fmtShort, shiftDate, todayKey } from '../lib/dates.js'

// Layout mirip Apple Notes: daftar catatan di kiri, editor di kanan.
export default function NotesSlide({ notes, activeId, onSelect, onChange, onNew, onDelete, onDate, onFocusChange }) {
  const ref = useRef(null)
  const active = notes.find((n) => n.id === activeId) || notes[0]

  const begin = async (e) => {
    if (document.activeElement === ref.current) return
    e.preventDefault()
    await window.island?.setFocusable(true)
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }

  const preview = (text) => {
    const line = (text || '').split('\n').find((s) => s.trim()) || 'Catatan kosong'
    return line.slice(0, 40)
  }

  return (
    <div className="notes-wrap">
      <div className="notes-list">
        <div className="notes-list-head">
          <span>Notes</span>
          <button className="notes-add" aria-label="Catatan baru" title="Catatan baru" onClick={onNew}>
            <IconPlus />
          </button>
        </div>
        <div className="notes-list-body">
          {notes.map((n) => (
            <button
              key={n.id}
              className={`notes-item ${n.id === active?.id ? 'on' : ''}`}
              onClick={() => onSelect(n.id)}
            >
              <span className="notes-item-title">{preview(n.text)}</span>
              {n.date && <span className="notes-item-date">{fmtShort(n.date)}</span>}
              <span
                className="notes-item-del"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(n.id)
                }}
                title="Hapus"
              >
                <IconTrash />
              </span>
            </button>
          ))}
          {notes.length === 0 && <div className="notes-empty">Belum ada catatan</div>}
        </div>
      </div>

      <div className="notes-editor">
        {/* Hubungkan catatan ke tanggal: muncul di kalender (slide Clock) sebagai titik */}
        <div className="notes-date">
          {active?.date ? (
            <>
              <button
                type="button"
                aria-label="Mundur satu hari"
                onClick={() => onDate(active.id, shiftDate(active.date, -1))}
              >
                ‹
              </button>
              <span className="notes-date-label" title="Tanggal di kalender">
                {fmtShort(active.date)}
              </span>
              <button
                type="button"
                aria-label="Maju satu hari"
                onClick={() => onDate(active.id, shiftDate(active.date, 1))}
              >
                ›
              </button>
              <button
                type="button"
                aria-label="Lepas dari tanggal"
                title="Lepas dari tanggal"
                onClick={() => onDate(active.id, null)}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!active}
              onClick={() => active && onDate(active.id, todayKey())}
            >
              + Tanggal
            </button>
          )}
        </div>
        <textarea
          ref={ref}
          className="notes"
          value={active?.text ?? ''}
          spellCheck={false}
          placeholder="Catatan baru…"
          disabled={!active}
          onMouseDown={begin}
          onChange={(e) => active && onChange(active.id, e.target.value)}
          onFocus={() => onFocusChange(true)}
          onBlur={() => {
            window.island?.setFocusable(false)
            onFocusChange(false)
          }}
        />
      </div>
    </div>
  )
}
