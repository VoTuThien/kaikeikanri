import { useRef, type MouseEvent, type PointerEvent } from 'react'

// Nhấn giữ lâu (giống iPhone): giữ yên ~0.5 giây thì gọi onLongPress.
// Kéo ngón tay đi (cuộn) thì huỷ. Sau khi nhấn giữ, lần "click" ngay sau đó bị chặn để không mở link.
// Phần tử dùng hook này nên có class LONG_PRESS_CLASS để iPhone không hiện menu xem trước link / chọn chữ.
export const LONG_PRESS_CLASS = 'select-none [-webkit-touch-callout:none]'

export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef({ x: 0, y: 0 })
  const fired = useRef(false)

  const clear = () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
  }

  return {
    onPointerDown(e: PointerEvent) {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        onLongPress()
      }, ms)
    },
    onPointerMove(e: PointerEvent) {
      if (timer.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu(e: MouseEvent) {
      e.preventDefault()
    },
    onClickCapture(e: MouseEvent) {
      if (fired.current) {
        e.preventDefault()
        e.stopPropagation()
        fired.current = false
      }
    },
  }
}
