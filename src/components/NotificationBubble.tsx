import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { useNotices } from '../lib/notifications'
import { useSalaryReminders } from '../pages/fund/data/salary'
import { NotificationList } from '../pages/family/NotificationList'
import { LineIcon } from './ui/Fab'

// Bong bóng thông báo (giống bong bóng chat), nổi trên MỌI màn hình sau khi đăng nhập:
// - Số đếm = yêu cầu xin gia nhập + nhắc nhập lương thực lãnh + ghi chú chưa xong / time line chưa xem (useNotices); chạm bong bóng mở POPUP thông báo ngay trên màn hình đang xem
//   (bong bóng bay lên góc trên, khung thông báo bung ra bên dưới; chạm lại bong bóng / nền mờ để đóng)
// - Kéo đi đâu cũng được, thả tay thì dính vào mép trái / phải của khung app (nhớ vị trí theo tài khoản)
// - Đang kéo thì hiện dấu X ở giữa dưới màn hình: KHÔNG có thông báo thì thả vào X để ẩn bong bóng;
//   CÓ thông báo thì không ẩn được (thả vào X bong bóng bật về chỗ cũ), và bong bóng đã ẩn sẽ tự hiện lại cho tới khi giải quyết xong
// - Bong bóng đang ẩn thì màn hình chính có nút chuông (useBubbleHidden / revealBubble): chạm để hiện lại bong bóng + mở popup

const SIZE = 44 // px, nhỏ gọn để không che nội dung
const TAIL = 6 // góc nhọn (đuôi bong bóng chat) quay về phía mép đang dính
const MARGIN = 6 // cách mép khung app
const TOP_MIN = 64 // không che thanh tiêu đề quá nhiều
const BOTTOM_RESERVE = 96 // chừa chỗ cho nút nổi (FAB) ở góc phải dưới
const DRAG_TOL = 6 // px: dịch quá chừng này thì là kéo, không phải chạm
const X_SIZE = 56
const X_BOTTOM = 40 // dấu X cách đáy màn hình
const X_HIT = 56 // thả bong bóng cách tâm dấu X chừng này thì tính là thả vào X
const FRAME_MAX = 448 // khung app rộng tối đa 28rem ở giữa màn hình
const POPUP_GUTTER = 8 // popup cách mép khung app
const CLOSE_MS = 220 // thời gian hiệu ứng đóng popup

type Side = 'left' | 'right'
interface Saved {
  side: Side
  y: number // vị trí dọc theo tỉ lệ chiều cao màn hình (0..1), để xoay / đổi máy vẫn hợp lý
  hidden: boolean
}
const DEFAULT: Saved = { side: 'right', y: 0.6, hidden: false }
const keyOf = (uid: string) => `notify-bubble:${uid}`

function load(uid: string): Saved {
  try {
    const raw = localStorage.getItem(keyOf(uid))
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Saved>) } : DEFAULT
  } catch {
    return DEFAULT
  }
}

function save(uid: string, s: Saved) {
  try {
    localStorage.setItem(keyOf(uid), JSON.stringify(s))
  } catch {
    // Không lưu được (chế độ riêng tư...): chỉ mất vị trí đã nhớ
  }
  notify()
}

// ---- Bong bóng đang ẩn: màn hình chính hiện nút chuông để gọi bong bóng ra lại ----
const subscribers = new Set<() => void>()
let openAfterReveal = false
const notify = () => subscribers.forEach((f) => f())
const subscribe = (f: () => void) => {
  subscribers.add(f)
  return () => {
    subscribers.delete(f)
  }
}

// Bong bóng của tài khoản này đang bị ẩn (đã kéo vào dấu X)
export function useBubbleHidden(uid: string | undefined) {
  return useSyncExternalStore(subscribe, () => (uid ? load(uid).hidden : false))
}

// Hiện lại bong bóng và mở luôn popup thông báo
export function revealBubble(uid: string) {
  openAfterReveal = true
  save(uid, { ...load(uid), hidden: false })
}

// Mép trái / phải của khung app (trên máy tính khung nằm giữa màn hình)
function frame() {
  const w = Math.min(window.innerWidth, FRAME_MAX)
  const left = (window.innerWidth - w) / 2
  return { left: left + MARGIN, right: left + w - SIZE - MARGIN }
}

const clampY = (y: number) => Math.max(TOP_MIN, Math.min(window.innerHeight - BOTTOM_RESERVE - SIZE, y))

export function NotificationBubble() {
  const { user } = useAuth()
  const { requests } = useFamily()
  const { pending } = useSalaryReminders()
  // Thông báo lưu lại còn cần xử lý (ghi chú chưa xong / time line chưa xem); đã xong / đã xem thì không tính
  const notices = useNotices()
  const count = requests.length + pending.length + notices.active
  if (!user) return null
  return <Bubble key={user.uid} uid={user.uid} count={count} />
}

function Bubble({ uid, count }: { uid: string; count: number }) {
  const { pathname } = useLocation()
  const [saved, setSaved] = useState(() => load(uid))
  // Vị trí đang kéo (px, góc trên trái của bong bóng); null = đang nằm ở mép theo `saved`
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [overX, setOverX] = useState(false)
  // Vừa hiện ra: phóng từ nhỏ lên (hiệu ứng "nhảy lên")
  const [popped, setPopped] = useState(false)
  const [, setViewport] = useState(0)
  const g = useRef<{ dx: number; dy: number; x0: number; y0: number; moved: boolean } | null>(null)
  // Popup thông báo (giống bong bóng chat Android): chạm bong bóng -> bong bóng bay lên góc trên, khung thông báo bung ra ngay dưới.
  // closing: đang chạy hiệu ứng đóng rồi mới gỡ khỏi màn hình
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const [shown, setShown] = useState(false) // khung đã bung ra hết (để chạy hiệu ứng mở từ trạng thái nhỏ)
  const [safe] = useState(safeInsets)
  const open = phase === 'open'

  function openPopup() {
    setPhase('open')
    window.setTimeout(() => setShown(true), 20)
  }
  function closePopup() {
    if (phase !== 'open') return
    setShown(false)
    setPhase('closing')
    window.setTimeout(() => setPhase('closed'), CLOSE_MS)
  }

  // Đổi màn hình (vd chạm nhắc lương mở màn hình Thực thi) thì đóng popup; phím Esc cũng đóng
  useEffect(() => {
    closePopup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePopup()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function update(next: Saved) {
    setSaved(next)
    save(uid, next)
  }

  // Màn hình chính gọi bong bóng ra lại (revealBubble): đọc lại trạng thái đã lưu và mở popup
  useEffect(
    () =>
      subscribe(() => {
        const next = load(uid)
        setSaved((cur) => (cur.hidden === next.hidden ? cur : next))
        if (openAfterReveal && !next.hidden) {
          openAfterReveal = false
          openPopup()
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid],
  )

  // Có thông báo mà bong bóng đang ẩn: tự hiện lại
  const hidden = saved.hidden && count === 0
  useEffect(() => {
    if (count > 0 && saved.hidden) update({ ...saved, hidden: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count > 0])

  // Hiệu ứng nhảy lên mỗi lần bong bóng hiện ra (mở app / có thông báo mới làm bong bóng hiện lại)
  useEffect(() => {
    if (hidden) return setPopped(false)
    // Chờ 1 nhịp cho trình duyệt vẽ trạng thái nhỏ trước rồi mới phóng lên
    const t = window.setTimeout(() => setPopped(true), 30)
    return () => window.clearTimeout(t)
  }, [hidden])

  // Đổi kích thước màn hình (xoay ngang / dọc) thì vẽ lại theo mép mới
  useEffect(() => {
    const on = () => setViewport((n) => n + 1)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  if (hidden) return null

  const edges = frame()
  // Popup đang mở: bong bóng nằm ở góc trên (cùng phía mép đang dính), khung thông báo ngay bên dưới
  const openTop = safe.top + 12
  const rest =
    phase === 'closed'
      ? { x: saved.side === 'left' ? edges.left : edges.right, y: clampY(saved.y * window.innerHeight) }
      : { x: saved.side === 'left' ? edges.left : edges.right, y: openTop }
  const pos = drag ?? rest
  const xCenter = { x: window.innerWidth / 2, y: window.innerHeight - X_BOTTOM - X_SIZE / 2 }
  const near = (x: number, y: number) => Math.hypot(x + SIZE / 2 - xCenter.x, y + SIZE / 2 - xCenter.y) < X_HIT

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    g.current = { dx: e.clientX - rest.x, dy: e.clientY - rest.y, x0: e.clientX, y0: e.clientY, moved: false }
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const st = g.current
    // Popup đang mở / đang đóng: bong bóng chỉ dùng để chạm đóng, không kéo
    if (!st || phase !== 'closed') return
    if (!st.moved && Math.hypot(e.clientX - st.x0, e.clientY - st.y0) < DRAG_TOL) return
    st.moved = true
    const x = e.clientX - st.dx
    const y = e.clientY - st.dy
    setDrag({ x, y })
    setOverX(near(x, y))
  }

  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    const st = g.current
    g.current = null
    setDrag(null)
    setOverX(false)
    if (!st) return
    // Chạm (không kéo): mở / đóng popup thông báo ngay trên màn hình đang xem
    if (!st.moved) {
      if (phase === 'closed') openPopup()
      else closePopup()
      return
    }
    const x = e.clientX - st.dx
    const y = e.clientY - st.dy
    // Thả vào X: không có thông báo thì ẩn; còn thông báo thì bật về chỗ cũ
    if (near(x, y)) {
      if (count === 0) update({ ...saved, hidden: true })
      return
    }
    // Dính vào mép gần hơn
    const mid = (edges.left + edges.right) / 2
    update({ ...saved, side: x < mid ? 'left' : 'right', y: clampY(y) / window.innerHeight })
  }

  function onPointerCancel() {
    g.current = null
    setDrag(null)
    setOverX(false)
  }

  const locked = count > 0
  return (
    <>
      {/* Dấu X ở giữa dưới màn hình: chỉ hiện khi đang kéo bong bóng */}
      {drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[44] flex flex-col items-center gap-1"
          style={{ left: xCenter.x - 60, width: 120, bottom: X_BOTTOM }}
        >
          <span
            className={`flex items-center justify-center rounded-full border-2 shadow-lg shadow-black/40 backdrop-blur-xl transition ${
              locked
                ? 'border-white/30 bg-slate-700/70 opacity-60'
                : overX
                  ? 'scale-110 border-white bg-rose-500/90'
                  : 'border-white/60 bg-black/50'
            }`}
            style={{ width: X_SIZE, height: X_SIZE }}
          >
            <LineIcon icon="cancel" className="h-6 w-6" />
          </span>
          {/* Còn thông báo: báo vì sao không ẩn được */}
          {locked && <span className="rounded-full bg-black/60 px-2 text-[11px] leading-5 text-white/90">Còn {count} thông báo</span>}
        </div>
      )}

      {phase !== 'closed' && (
        <NotificationPopup
          shown={shown}
          top={openTop + SIZE + 12}
          bottom={safe.bottom + 16}
          arrowX={rest.x + SIZE / 2}
          count={count}
          onClose={closePopup}
        />
      )}

      <button
        type="button"
        data-no-swipe
        aria-label={open ? 'Đóng thông báo' : count ? `Thông báo (${count})` : 'Thông báo'}
        aria-expanded={open}
        title="Thông báo"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        className={`fixed top-0 left-0 z-[45] flex touch-none items-center justify-center border border-white/30 bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-lg shadow-black/40 select-none [-webkit-touch-callout:none] ${
          drag ? '' : 'transition-[transform,opacity,border-radius] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]'
        } ${overX && !locked ? 'opacity-60' : ''}`}
        style={{
          width: SIZE,
          height: SIZE,
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${popped ? (drag ? 1.1 : 1) : 0})`,
          // Đuôi bong bóng chat quay về phía mép đang dính (popup mở thì tròn hẳn)
          borderRadius: SIZE / 2,
          borderBottomLeftRadius: saved.side === 'left' && !drag && phase === 'closed' ? TAIL : SIZE / 2,
          borderBottomRightRadius: saved.side === 'right' && !drag && phase === 'closed' ? TAIL : SIZE / 2,
        }}
      >
        {/* Chuông <-> dấu X (popup mở): xoay + đổi chỗ cho mượt */}
        <span className={`absolute transition duration-300 ${open ? 'scale-50 -rotate-90 opacity-0' : ''}`}>
          <LineIcon icon="bell" className="h-5 w-5" />
        </span>
        <span className={`absolute transition duration-300 ${open ? '' : 'scale-50 rotate-90 opacity-0'}`}>
          <LineIcon icon="cancel" className="h-5 w-5" />
        </span>
        {/* Có thông báo: vòng sáng nhấp nháy + số đếm (ẩn khi popup đang mở) */}
        {locked && !open && <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-fuchsia-400/40" />}
        {locked && !open && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-indigo-950 bg-rose-500 px-1 text-[10px] leading-none font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </>
  )
}

// Khoảng an toàn của iPhone (tai thỏ / thanh home) đo bằng env(), để popup không bị che
function safeInsets() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 }
  probe.remove()
  return out
}

// Khung thông báo bung ra từ bong bóng (kiểu bong bóng chat Android): nền mờ phía sau, khung glass có mũi nhọn chỉ vào bong bóng,
// phóng to từ chỗ mũi nhọn (hơi nảy), các dòng thông báo hiện lần lượt. Chạm nền mờ / bong bóng / phím Esc để đóng.
function NotificationPopup({
  shown,
  top,
  bottom,
  arrowX,
  count,
  onClose,
}: {
  shown: boolean
  top: number
  bottom: number
  arrowX: number // toạ độ x (màn hình) của tâm bong bóng
  count: number
  onClose: () => void
}) {
  const w = Math.min(window.innerWidth, FRAME_MAX) - POPUP_GUTTER * 2
  const left = (window.innerWidth - w) / 2
  const arrow = Math.max(24, Math.min(w - 24, arrowX - left))
  return (
    <>
      {/* Nền mờ: chạm để đóng */}
      <div
        data-no-swipe
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[43] bg-black/45 backdrop-blur-[3px] transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-label="Thông báo"
        data-no-swipe
        className={`fixed z-[44] flex flex-col rounded-3xl border border-white/15 bg-indigo-950/85 shadow-2xl shadow-black/60 backdrop-blur-2xl ${
          shown
            ? 'scale-100 opacity-100 transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.34,1.36,0.64,1)]'
            : 'scale-[0.35] opacity-0 transition-[transform,opacity] duration-200 ease-in'
        }`}
        style={{ top, left, width: w, maxHeight: window.innerHeight - top - bottom, transformOrigin: `${arrow}px -10px` }}
      >
        {/* Mũi nhọn chỉ vào bong bóng */}
        <span
          aria-hidden="true"
          className="absolute -top-[7px] h-3.5 w-3.5 rotate-45 rounded-[3px] border-t border-l border-white/15 bg-indigo-950"
          style={{ left: arrow - 7 }}
        />
        <div className="flex h-12 shrink-0 items-center gap-2 px-4">
          <h2 className="text-base leading-6 font-bold">Thông báo</h2>
          {count > 0 && <span className="rounded-full bg-rose-500 px-2 text-xs leading-5 font-bold">{count}</span>}
        </div>
        {/* Chỉ phần danh sách được cuộn */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 scroll-thin">
          <NotificationList animated onNavigate={onClose} />
        </div>
      </div>
    </>
  )
}
