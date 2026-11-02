import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

// Thẻ trượt sang TRÁI để hiện nút thao tác ở mép phải (dùng ở Tra cứu, Nhóm quỹ).
// - Trượt quá nửa bề rộng nút rồi thả: thẻ dừng ở trạng thái mở (hiện nút); trượt ngược / chạm vào thẻ: đóng lại
// - onPullBeyond (không bắt buộc): thay vì mở, trượt quá bề rộng nút rồi thả thì gọi hàm này (vd thẻ đã xoá -> nhập lại)
// - Trượt dọc thì để danh sách cuộn bình thường; vừa trượt xong thì cú chạm không mở link / nút bên trong thẻ
// Icon trên nút dùng LineIcon (nét trắng giống FAB), KHÔNG dùng icon 3D (quy ước trong CLAUDE.md).
export function SwipeActions({
  children,
  width,
  actions,
  open,
  onOpen,
  onClose,
  onPullBeyond,
  maxPull,
  disabled,
  className = '',
}: {
  children: ReactNode
  width: number // bề rộng vùng nút (px)
  actions: (pull: number) => ReactNode // vẽ vùng nút; pull = thẻ đang bị kéo bao nhiêu px
  open: boolean
  onOpen: () => void
  onClose: () => void
  onPullBeyond?: () => void
  maxPull?: number
  disabled?: boolean
  className?: string // nền / kiểu của thẻ (phải đặc hoặc đủ đậm vì nút nằm phía sau)
}) {
  const [drag, setDrag] = useState<number | null>(null)
  // Vị trí kéo lưu cả trong ref để lúc thả tay đọc được ngay, kể cả khi state chưa kịp cập nhật
  const g = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; base: number; pull: number } | null>(null)
  const justSwiped = useRef(false)
  const max = maxPull ?? width * 1.3
  const pull = drag ?? (open ? width : 0)

  function down(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return
    const base = open ? width : 0
    g.current = { x: e.clientX, y: e.clientY, axis: null, base, pull: base }
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const st = g.current
    if (!st) return
    const dx = e.clientX - st.x
    const dy = e.clientY - st.y
    if (!st.axis && Math.hypot(dx, dy) > 8) {
      st.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (st.axis === 'x') e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (st.axis === 'x') {
      // Kéo sang trái (dx âm) thì mở ra
      st.pull = Math.max(0, Math.min(max, st.base - dx))
      setDrag(st.pull)
    }
  }
  function up() {
    const st = g.current
    g.current = null
    setDrag(null)
    if (!st || st.axis !== 'x') return
    justSwiped.current = true
    if (onPullBeyond) {
      if (st.pull > width) onPullBeyond()
    } else if (st.pull > width / 2) onOpen()
    else onClose()
  }
  // Chạm khi đang mở thì chỉ đóng lại; vừa trượt xong thì bỏ qua cú chạm
  function clickCapture(e: MouseEvent) {
    if (justSwiped.current || open) {
      e.preventDefault()
      e.stopPropagation()
      if (!justSwiped.current) onClose()
    }
    justSwiped.current = false
  }

  return (
    <div className="relative overflow-hidden">
      {/* Vùng nút: chỉ rộng bằng phần thẻ đã trượt để không lộ ra sau thẻ trong suốt */}
      {!disabled && pull > 0 && (
        <div className="absolute inset-y-0 right-0 flex justify-end overflow-hidden" style={{ width: pull }}>
          <div className="h-full shrink-0" style={{ width: Math.max(width, pull) }}>
            {actions(pull)}
          </div>
        </div>
      )}
      <div
        className={`relative touch-pan-y select-none ${className} ${drag === null ? 'transition-transform duration-200' : ''}`}
        style={{ transform: `translateX(${-pull}px)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={clickCapture}
      >
        {children}
      </div>
    </div>
  )
}
