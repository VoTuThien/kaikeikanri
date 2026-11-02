import { useRef, useState, type PointerEvent } from 'react'

// Kéo thả để sắp xếp lại danh sách theo chiều dọc (dùng ở Lệnh chuyển, Nhóm quỹ):
// - Giữ tay cầm (≡) của 1 mục rồi kéo lên / xuống; mục đang kéo đi theo ngón tay, các mục khác nhích ra chừa chỗ
// - Thả tay thì gọi onDrop(danh sách mới) nếu vị trí thay đổi
// listRef gắn vào phần tử bọc các mục (mỗi mục là 1 con trực tiếp) để đo khoảng cách giữa 2 mục (gồm cả khoảng trống).
type Drag = { from: number; startY: number; dy: number; step: number }

export function useDragReorder<T>(list: T[], onDrop: (next: T[]) => void) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Vị trí sẽ thả = vị trí cũ + số hàng đã kéo qua
  const target = drag ? Math.max(0, Math.min(list.length - 1, drag.from + Math.round(drag.dy / drag.step))) : -1

  // Các mục khác nhích lên / xuống 1 hàng để chừa chỗ cho mục đang kéo
  function shift(i: number) {
    if (!drag || i === drag.from) return 0
    if (drag.from < target && i > drag.from && i <= target) return -drag.step
    if (drag.from > target && i >= target && i < drag.from) return drag.step
    return 0
  }

  // Số thứ tự hiển thị trong lúc kéo (1-based)
  function displayIndex(i: number) {
    if (drag && i === drag.from) return target + 1
    const s = shift(i)
    return i + 1 + (s < 0 ? -1 : s > 0 ? 1 : 0)
  }

  // Khoảng cách giữa 2 mục liên tiếp (chiều cao mục + khoảng trống)
  function measure(i: number) {
    const kids = listRef.current?.children
    const cur = kids?.[i] as HTMLElement | undefined
    if (!cur) return 64
    const next = kids?.[i + 1] as HTMLElement | undefined
    const prev = kids?.[i - 1] as HTMLElement | undefined
    if (next) return next.offsetTop - cur.offsetTop
    if (prev) return cur.offsetTop - prev.offsetTop
    return cur.offsetHeight
  }

  // Gắn vào tay cầm của mục thứ i
  function handleProps(i: number) {
    return {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag({ from: i, startY: e.clientY, dy: 0, step: measure(i) })
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        if (drag) setDrag({ ...drag, dy: e.clientY - drag.startY })
      },
      onPointerUp() {
        if (!drag) return
        const to = target
        setDrag(null)
        if (to === drag.from) return
        const next = [...list]
        const [moved] = next.splice(drag.from, 1)
        next.splice(to, 0, moved)
        onDrop(next)
      },
      onPointerCancel() {
        setDrag(null)
      },
    }
  }

  // Dịch chuyển của mục thứ i (mục đang kéo đi theo ngón tay)
  const offsetOf = (i: number) => (drag && i === drag.from ? drag.dy : shift(i))
  const isDragging = (i: number) => !!drag && i === drag.from

  return { listRef, handleProps, offsetOf, isDragging, displayIndex, dragging: !!drag }
}
