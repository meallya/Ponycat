import { useEffect, useRef } from 'react'
import { motion, animate, useMotionValue, useDragControls } from 'framer-motion'

const SNAP = { type: 'spring', stiffness: 420, damping: 38, mass: 0.8 }

// Slide horizontal. Bisa digeser: drag mouse/sentuh, scroll mouse/touchpad, atau ganti `index` dari luar.
export default function Carousel({ index, onIndex, width, height, onDragged, children }) {
  const count = children.length
  const x = useMotionValue(-index * width)
  const controls = useDragControls()
  const target = useRef(index)
  const lastWheel = useRef(0)
  const wheelHandled = useRef(false)

  // Perubahan index dari luar (klik titik, notifikasi otomatis, dll)
  useEffect(() => {
    if (target.current === index) return
    target.current = index
    animate(x, -index * width, SNAP)
  }, [index, width, x])

  const go = (i) => {
    const n = Math.max(0, Math.min(count - 1, i))
    target.current = n
    animate(x, -n * width, SNAP)
    onIndex(n)
  }

  const onWheel = (e) => {
    // Kotak Notes yang isinya panjang boleh scroll sendiri secara vertikal.
    // Kalau isinya pendek, scroll tetap dipakai untuk pindah slide.
    const ta = e.target.closest('textarea')
    if (ta && Math.abs(e.deltaY) > Math.abs(e.deltaX) && ta.scrollHeight > ta.clientHeight + 1) return
    const now = performance.now()
    // Satu gesture touchpad menghasilkan banyak event; hanya pindah satu slide per gesture
    if (now - lastWheel.current > 160) wheelHandled.current = false
    lastWheel.current = now
    if (wheelHandled.current) return
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(d) < 10) return
    wheelHandled.current = true
    go(target.current + (d > 0 ? 1 : -1))
  }

  return (
    <div
      className="viewport"
      style={{ width, height }}
      onWheel={onWheel}
      onPointerDown={(e) => {
        // Tombol dan kotak ketik tidak boleh memulai geseran
        if (e.target.closest('button, textarea, input, .notes-list, .temp-list')) return
        controls.start(e)
      }}
    >
      <motion.div
        className="track"
        drag="x"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ left: -(count - 1) * width, right: 0 }}
        dragElastic={0.14}
        dragMomentum={false}
        style={{ x, width: count * width }}
        onDragStart={() => onDragged?.('start')}
        onDragEnd={(_e, info) => {
          onDragged?.('end')
          const projected = info.offset.x + info.velocity.x * 0.18
          let n = target.current
          if (projected < -width * 0.18) n += 1
          else if (projected > width * 0.18) n -= 1
          go(n)
        }}
      >
        {children.map((child, i) => (
          <div className="slide" key={i} style={{ width, height }}>
            {child}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
