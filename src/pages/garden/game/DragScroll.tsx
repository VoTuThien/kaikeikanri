import { useEffect, useRef, type ReactNode } from 'react'
import { useLandscape } from './LandscapeFrame'

// Vùng cuộn TỰ LÀM trong game (khung game có thể đang xoay 90° nên không dựa vào cuộn gốc của trình duyệt):
// kéo theo trục `axis` (toạ độ đã đổi qua `toLocal`), thả tay thì trôi tiếp có quán tính, 2 đầu có lực kéo lại.
// Kéo quá 8px mới tính là cuộn; đã cuộn thì chặn cú chạm (click) của mục bên dưới. Lăn chuột cũng cuộn được.
export function DragScroll({ axis, className = '', children }: { axis: 'x' | 'y'; className?: string; children: ReactNode }) {
  const { toLocal } = useLandscape()
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const st = useRef({ pos: 0, v: 0, down: false, moved: false, start: 0, startPos: 0, last: 0, lastT: 0, raf: 0, id: -1 })

  const max = () => {
    const b = box.current, i = inner.current
    if (!b || !i) return 0
    return Math.max(0, axis === 'x' ? i.scrollWidth - b.clientWidth : i.scrollHeight - b.clientHeight)
  }
  const paint = () => {
    if (inner.current) inner.current.style.transform = axis === 'x' ? `translate3d(${-st.current.pos}px,0,0)` : `translate3d(0,${-st.current.pos}px,0)`
  }
  const coord = (e: { clientX: number; clientY: number }) => { const p = toLocal(e.clientX, e.clientY); return axis === 'x' ? p.x : p.y }

  // trôi có quán tính + kéo về khi vượt 2 đầu
  const glide = () => {
    const s = st.current
    cancelAnimationFrame(s.raf)
    const step = () => {
      const m = max()
      if (s.pos < 0 || s.pos > m) {
        const edge = s.pos < 0 ? 0 : m
        s.pos += (edge - s.pos) * 0.2; s.v = 0
        if (Math.abs(edge - s.pos) < 0.5) s.pos = edge
      } else {
        s.pos += s.v; s.v *= 0.94
      }
      paint()
      if (Math.abs(s.v) > 0.2 || s.pos < 0 || s.pos > m) s.raf = requestAnimationFrame(step)
    }
    s.raf = requestAnimationFrame(step)
  }
  useEffect(() => () => cancelAnimationFrame(st.current.raf), [])
  // nội dung đổi (ít mục hơn) thì đưa về trong giới hạn
  useEffect(() => { const s = st.current; const m = max(); if (s.pos > m) { s.pos = m; paint() } })

  return (
    <div
      ref={box}
      className={`overflow-hidden ${className}`}
      onPointerDown={(e) => {
        const s = st.current
        cancelAnimationFrame(s.raf)
        s.down = true; s.moved = false; s.id = e.pointerId
        s.start = s.last = coord(e); s.startPos = s.pos; s.v = 0; s.lastT = performance.now()
      }}
      onPointerMove={(e) => {
        const s = st.current
        if (!s.down || e.pointerId !== s.id) return
        const c = coord(e)
        if (!s.moved && Math.abs(c - s.start) > 8) {
          s.moved = true
          try { box.current?.setPointerCapture(e.pointerId) } catch { /* bỏ qua */ }
        }
        if (!s.moved) return
        const m = max()
        let p = s.startPos - (c - s.start)
        if (p < 0) p *= 0.35
        else if (p > m) p = m + (p - m) * 0.35
        const now = performance.now()
        s.v = (s.last - c) / Math.max(1, now - s.lastT) * 16
        s.last = c; s.lastT = now
        s.pos = p; paint()
      }}
      onPointerUp={() => { const s = st.current; if (!s.down) return; s.down = false; if (s.moved) glide() }}
      onPointerCancel={() => { st.current.down = false; glide() }}
      onClickCapture={(e) => { if (st.current.moved) { e.stopPropagation(); e.preventDefault(); st.current.moved = false } }}
      onWheel={(e) => { const s = st.current; s.pos = Math.max(0, Math.min(max(), s.pos + (axis === 'x' ? e.deltaY + e.deltaX : e.deltaY))); paint() }}
    >
      <div ref={inner} className={`will-change-transform ${axis === 'x' ? 'flex w-max' : ''}`}>
        {children}
      </div>
    </div>
  )
}
