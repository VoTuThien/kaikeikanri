import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

// Chuyển động khi thả tay (thẻ trượt về / mở ra): thẻ và vùng nút dùng CHUNG thời gian + đường cong để luôn khớp nhau
const MOTION = '200ms cubic-bezier(0.4, 0, 0.2, 1)'

// Thẻ trượt sang TRÁI để hiện nút thao tác ở mép phải (dùng ở Tra cứu, Nhóm quỹ, các danh sách của app Ghi chú).
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
  radius = 0,
  overlap = radius,
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
  // Độ bo góc của thẻ (px), vd 16 cho rounded-2xl: khung ngoài bo tròn khớp thẻ để vùng nút ở mép phải cũng bo theo.
  radius?: number
  // Nền nút lấn sang trái bao nhiêu px, NẰM DƯỚI thẻ (mặc định = radius): thẻ glass trong suốt thì nền nút ánh qua mép thẻ,
  // thẻ bo góc thì 2 góc bo bên phải cũng có màu nút. Nút trong `actions` thêm lề trái bằng chừng này (vd pl-4) để chữ / icon nằm giữa phần lộ ra.
  overlap?: number
  className?: string // nền / kiểu của thẻ (trong suốt / glass được: vùng nút chỉ rộng bằng phần thẻ đã trượt ra + overlap)
}) {
  const [drag, setDrag] = useState<number | null>(null)
  // Vị trí kéo lưu cả trong ref để lúc thả tay đọc được ngay, kể cả khi state chưa kịp cập nhật
  const g = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; base: number; pull: number } | null>(null)
  const justSwiped = useRef(false)
  const max = maxPull ?? width * 1.3
  const pull = drag ?? (open ? width : 0)
  // Mỗi lần thẻ bắt đầu lộ nút ra thì vẽ lại nội dung nút từ đầu (vd thùng rác đã chạm 1 lần "Xoá?" thì lần mở sau về lại "Xoá"),
  // vì vùng nút luôn có mặt để chạy chuyển động đóng cho khớp với thẻ
  const session = useRef(0)
  const wasShown = useRef(false)
  if (pull > 0 && !wasShown.current) session.current++
  wasShown.current = pull > 0

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
    // Bo góc khung ngoài bằng thẻ để vùng nút ở mép phải cũng bo tròn khớp với thẻ
    <div className="relative overflow-hidden" style={radius ? { borderRadius: radius } : undefined}>
      {/* Vùng nút: rộng bằng phần thẻ đã trượt (+ overlap lấn dưới mép thẻ), thẻ vẽ sau nên nằm trên nền nút.
          Luôn có mặt (rộng 0 khi đóng) và đổi bề rộng CÙNG chuyển động với thẻ, để lúc thả tay thẻ trượt về
          (kéo mạnh quá bề rộng nút, hoặc đóng lại) không hở ra mép trống giữa thẻ và nền nút. */}
      {!disabled && (
        <div
          className="absolute inset-y-0 right-0 flex justify-end overflow-hidden"
          style={{ width: pull > 0 ? pull + overlap : 0, transition: drag === null ? `width ${MOTION}` : 'none' }}
        >
          {/* Nền nút luôn phủ kín vùng nút (kể cả lúc kéo quá bề rộng nút), tối thiểu bằng bề rộng nút để nội dung không bị bóp */}
          {/* Đang đóng (không lộ nút) thì không bấm / focus được vào nút */}
          <div key={session.current} className="h-full w-full shrink-0" style={{ minWidth: width + overlap }} inert={pull === 0}>
            {actions(pull)}
          </div>
        </div>
      )}
      <div
        className={`relative touch-pan-y select-none ${className}`}
        style={{ transform: `translateX(${-pull}px)`, transition: drag === null ? `transform ${MOTION}` : 'none' }}
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
