import { useRef } from 'react'
import { IconPlus, IconTrash } from './icons.jsx'
import { fmtShort, shiftDate, todayKey } from '../lib/dates.js'
import { fmtTimer } from '../lib/format.js'
import { IconPlay, IconPause } from './icons.jsx'
import { MIN_MINUTES, MAX_MINUTES, STEP_MINUTES } from '../hooks/useFocus.js'

// Layout mirip Apple Notes: daftar catatan di kiri, editor di kanan.
export default function NotesSlide({
  notes,
  activeId,
  onSelect,
  onChange,
  onNew,
  onDelete,
  onDate,
  onFocusChange,
  focus,
  onFinish,
  onReopen,
}) {
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

  const hasText = Boolean(active?.text?.trim())
  const focusing = Boolean(active && focus?.noteId === active.id)
  const other = focus?.noteId && !focusing ? notes.find((n) => n.id === focus.noteId) : null

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
              className={`notes-item ${n.id === active?.id ? 'on' : ''} ${n.done ? 'done' : ''} ${focus?.noteId === n.id ? 'focusing' : ''}`}
              onClick={() => onSelect(n.id)}
            >
              <span className="notes-item-title">
                {n.done ? '✓ ' : focus?.noteId === n.id ? '● ' : ''}
                {preview(n.text)}
              </span>
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
        <div className="notes-bar">
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

        {/* Fokus: hitung mundur untuk mengerjakan satu catatan saja */}
        <div className="notes-focus">
          {active?.done ? (
            <>
              <span className="focus-done">✓ Selesai</span>
              <button type="button" onClick={() => onReopen(active.id)}>
                Catat ulang
              </button>
            </>
          ) : focusing ? (
            <>
              <span className={`focus-time ${focus.ended ? 'end' : ''}`}>
                {focus.ended ? 'Waktu habis' : fmtTimer(focus.left)}
              </span>
              {!focus.ended && (
                <button
                  type="button"
                  className="icon"
                  aria-label={focus.running ? 'Jeda' : 'Lanjut'}
                  onClick={focus.toggle}
                >
                  {focus.running ? <IconPause size={10} /> : <IconPlay size={10} />}
                </button>
              )}
              <button type="button" title="Tambah 5 menit" onClick={() => focus.extend(5)}>
                +5m
              </button>
              <button type="button" className="ok" onClick={() => onFinish(active.id)}>
                ✓ Selesai
              </button>
              <button type="button" aria-label="Batalkan fokus" title="Batalkan fokus" onClick={focus.stop}>
                ✕
              </button>
            </>
          ) : other ? (
            <button type="button" title="Pindah ke catatan yang sedang difokuskan" onClick={() => onSelect(other.id)}>
              Fokus: {preview(other.text).slice(0, 14)} · {fmtTimer(focus.left)}
            </button>
          ) : (
            <>
              <button
                type="button"
                aria-label="Kurangi menit"
                disabled={focus.minutes <= MIN_MINUTES}
                onClick={() => focus.setMinutes(focus.minutes - STEP_MINUTES)}
              >
                −
              </button>
              <span className="focus-min">{focus.minutes}m</span>
              <button
                type="button"
                aria-label="Tambah menit"
                disabled={focus.minutes >= MAX_MINUTES}
                onClick={() => focus.setMinutes(focus.minutes + STEP_MINUTES)}
              >
                +
              </button>
              <button
                type="button"
                className="ok"
                disabled={!hasText}
                title={hasText ? 'Fokus pada catatan ini' : 'Tulis catatan dulu'}
                onClick={() => focus.start(active.id)}
              >
                ▶ Fokus
              </button>
            </>
          )}
        </div>
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
