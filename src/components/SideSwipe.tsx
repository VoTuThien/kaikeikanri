import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasUnsaved } from './UnsavedGuard'
import { getCachedLauncher, loadHomeScreen, markShortcutEntry, saveHomeScreen, sidePath, useShortcuts } from '../lib/shortcuts'

// Vuốt ngang giữa màn hình chính và 2 màn hình 2 bên, giống màn hình chính iPhone:
// màn hình bên cạnh như đã nằm sẵn ở mép, đi theo ngón tay trong lúc kéo, thả tay thì trượt nốt vào chỗ.
//   - Ở màn hình chính: vuốt sang phải -> màn hình bên trái, vuốt sang trái -> màn hình bên phải
//     (chưa thiết đặt thì là trang có dấu "+" để chọn, /side/left | /side/right)
//   - Đang ở màn hình được thiết đặt (vào từ bất kỳ đâu: menu của app con, phím tắt, vuốt): vuốt ngược lại để về màn hình chính
// Bỏ qua thao tác bắt đầu trên canvas 3D, ô nhập, hoặc phần tử có [data-no-swipe] (vd khay kéo thả, chế độ gỡ phím tắt).
//
// Cách làm: mỗi màn hình là 1 lớp phủ kín khung (absolute inset-0). Khi bắt đầu kéo thì vẽ thêm lớp màn hình bên cạnh
// (<Routes location=...>) nằm ngay ngoài mép, rồi dịch cả 2 lớp theo ngón tay. Hai lớp có key = đường dẫn, nên khi chuyển xong
// lớp bên cạnh trở thành lớp chính mà không phải vẽ lại từ đầu (không nháy skeleton).
// Nút nổi (position: fixed) trong lớp đang dịch sẽ đi theo lớp đó (transform làm fixed bám theo lớp), đúng như mong muốn.
//
// LỊCH SỬ TRANG (cho cử chỉ "vuốt từ mép màn hình để quay lại / tiến tới" của iOS, nhất là iOS 15 — cử chỉ này đi theo
// lịch sử trình duyệt chứ không theo code của app): màn hình 2 bên mở từ màn hình chính (vuốt, hoặc tự mở lại lúc mở app)
// luôn được ĐẶT NGAY SAU "/" trong lịch sử (state.fromHome), và vuốt từ màn hình đó về màn hình chính thì LÙI 1 bước (navigate(-1))
// thay vì thêm "/" mới. Nhờ vậy cử chỉ quay lại của iOS ở màn hình 2 bên cũng về đúng màn hình chính, không về trang cũ
// (vd menu của app con) còn sót trong lịch sử.
// iOS giành cử chỉ (touchcancel) thì chỉ trả màn hình về chỗ, không tự chuyển trang (tránh chuyển 2 lần).

const IGNORE = 'canvas, input, textarea, select, [data-no-swipe]'
const DURATION = 280 // ms, thời gian trượt nốt sau khi thả tay
const EASE = 'cubic-bezier(0.22, 0.8, 0.3, 1)'
const COMMIT_RATIO = 0.3 // kéo quá 30% bề rộng thì chuyển
const FLING_SPEED = 0.45 // px/ms: vuốt nhanh thì chuyển dù kéo chưa xa

// dir: hướng ngón tay (1 = sang phải, -1 = sang trái); màn hình bên cạnh nằm ở phía ngược lại (-dir)
type Peer = { to: string; dir: 1 | -1 }

export function SideSwipe({ render }: { render: (location?: string) => ReactNode }) {
  const { user } = useAuth()
  const { left, right } = useShortcuts(user?.uid)
  const { pathname, state } = useLocation()
  // Màn hình hiện tại được mở từ "/" (ngay sau "/" trong lịch sử): về màn hình chính thì lùi lại 1 bước
  const fromHome = !!(state as { fromHome?: boolean } | null)?.fromHome
  const navigate = useNavigate()
  const boxRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const peerRef = useRef<HTMLDivElement>(null)
  const [peer, setPeer] = useState<Peer | null>(null)

  const leftPath = sidePath('left', left)
  const rightPath = sidePath('right', right)

  // Vuốt theo hướng dir thì sang màn hình nào; null = không làm gì
  function targetOf(dir: number): string | null {
    if (!user) return null
    if (pathname === '/') return dir > 0 ? leftPath : rightPath
    if (pathname === leftPath && dir < 0) return '/'
    if (pathname === rightPath && dir > 0) return '/'
    return null
  }
  // Bỏ dịch chuyển trên các lớp (để position: fixed của nút nổi hoạt động bình thường khi không kéo)
  function resetLayers() {
    for (const el of [mainRef.current, peerRef.current]) {
      if (!el) continue
      el.style.transition = ''
      el.style.transform = ''
    }
  }

  // Đã sang màn hình mới (vuốt xong, hoặc đổi trang bằng cách khác): bỏ lớp bên cạnh, trả lớp chính về chỗ
  useLayoutEffect(() => {
    resetLayers()
    setPeer(null)
  }, [pathname])

  // Nhớ người dùng đang ở màn hình giữa / bên trái / bên phải, để thoát app rồi mở lại vẫn về đúng chỗ
  const startPath = useRef(window.location.pathname) // URL lúc mở app
  const restoring = useRef<string | null | undefined>(undefined) // undefined = chưa khôi phục; chuỗi = đang chuyển tới
  const uid = user?.uid
  useEffect(() => {
    if (!uid || restoring.current !== undefined) return
    restoring.current = null
    // Chỉ khi mở app ở màn hình chính (PWA luôn mở ở "/"); mở link tới trang cụ thể thì giữ nguyên
    const saved = loadHomeScreen(uid)
    if (startPath.current !== '/' || pathname !== '/' || saved === 'home') return
    const cached = getCachedLauncher(uid)
    const to = sidePath(saved, cached[saved])
    restoring.current = to
    markShortcutEntry(to) // nút quay lại (‹) trên màn hình đó về thẳng màn hình chính
    // Giữ "/" trong lịch sử, mở màn hình đã lưu NGAY SAU nó: cử chỉ quay lại của iOS ở đó về đúng màn hình chính
    navigate(to, { state: { fromHome: true } })
  }, [uid, pathname, navigate])
  useEffect(() => {
    if (!uid || restoring.current === undefined) return
    // Đang chuyển tới màn hình đã lưu: chưa ghi đè lựa chọn cũ bằng "/" lúc vừa mở
    if (restoring.current) {
      if (pathname !== restoring.current) return
      restoring.current = null
    }
    if (pathname === '/') saveHomeScreen(uid, 'home')
    else if (pathname === leftPath) saveHomeScreen(uid, 'left')
    else if (pathname === rightPath) saveHomeScreen(uid, 'right')
    // Các trang khác (vào app con...) giữ nguyên lựa chọn: mở lại app thì về màn hình đã rời đi
  }, [uid, pathname, leftPath, rightPath])

  // Trình xử lý chạm gắn 1 lần, luôn đọc giá trị mới nhất qua ref
  // Chuyển sang màn hình `to` sau khi vuốt: từ "/" sang màn hình 2 bên thì đánh dấu fromHome; từ màn hình 2 bên (mở từ "/") về "/" thì lùi lại
  function go(to: string) {
    if (to === '/' && fromHome && window.history.length > 1) navigate(-1)
    else navigate(to, pathname === '/' ? { state: { fromHome: true } } : undefined)
  }
  const latest = useRef({ targetOf, go, setPeer, resetLayers })
  latest.current = { targetOf, go, setPeer, resetLayers }

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let g: { x: number; y: number; dx: number; axis: 'x' | 'y' | null; peer: Peer | null; t: number; v: number } | null = null
    let animating = false

    const layers = () => [mainRef.current, peerRef.current]
    function place(dx: number, p: Peer | null, transition = '') {
      const w = box!.clientWidth
      const [main, side] = layers()
      if (main) {
        main.style.transition = transition
        main.style.transform = `translate3d(${dx}px,0,0)`
      }
      if (side && p) {
        side.style.transition = transition
        side.style.transform = `translate3d(${dx - p.dir * w}px,0,0)`
      }
    }

    function onStart(e: TouchEvent) {
      const t = e.touches[0]
      // Màn hình đang có thông tin chưa lưu: không cho vuốt chuyển trang (dùng nút quay lại để được hỏi lưu / bỏ)
      const blocked = animating || hasUnsaved() || e.touches.length !== 1 || (e.target as Element).closest?.(IGNORE)
      const { targetOf } = latest.current
      g = blocked || (!targetOf(1) && !targetOf(-1)) ? null : { x: t.clientX, y: t.clientY, dx: 0, axis: null, peer: null, t: e.timeStamp, v: 0 }
    }

    function onMove(e: TouchEvent) {
      if (!g) return
      const t = e.touches[0]
      const dx = t.clientX - g.x
      const dy = t.clientY - g.y
      // Xác định hướng 1 lần: ngang rõ ràng mới tính là vuốt, còn lại để cuộn dọc như bình thường
      if (!g.axis && Math.hypot(dx, dy) > 8) g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
      if (g.axis !== 'x') return
      e.preventDefault() // đang vuốt ngang thì không cho trang cuộn dọc theo

      // Tốc độ (px/ms) để biết vuốt nhanh
      const dt = e.timeStamp - g.t
      if (dt > 0) g.v = 0.8 * ((dx - g.dx) / dt) + 0.2 * g.v
      g.t = e.timeStamp

      const dir = dx > 0 ? 1 : -1
      const to = dx === 0 ? null : latest.current.targetOf(dir)
      // Đổi hướng kéo thì đổi màn hình bên cạnh
      if (to && (g.peer?.to !== to || g.peer.dir !== dir)) {
        g.peer = { to, dir }
        latest.current.setPeer(g.peer)
      }
      // Không có màn hình phía đó: kéo nặng tay (chỉ nhích 1 chút) rồi bật lại
      g.dx = to ? dx : dx * 0.15
      place(g.dx, to ? g.peer : null)
    }

    // cancelled: iOS giành cử chỉ (vd vuốt từ mép để quay lại trang trước) -> chỉ trả màn hình về chỗ, không chuyển trang
    function onEnd(cancelled = false) {
      const cur = g
      g = null
      if (!cur || cur.axis !== 'x') return
      const w = box!.clientWidth
      const p = cur.peer
      const valid = p && Math.sign(cur.dx) === p.dir
      const fling = Math.abs(cur.v) > FLING_SPEED && Math.sign(cur.v) === Math.sign(cur.dx)
      const commit = !cancelled && valid && (Math.abs(cur.dx) > w * COMMIT_RATIO || fling)

      animating = true
      const transition = `transform ${DURATION}ms ${EASE}`
      place(commit ? p.dir * w : 0, valid ? p : null, transition)
      window.setTimeout(() => {
        animating = false
        const { go, setPeer, resetLayers } = latest.current
        if (commit) {
          // Vào màn hình được thiết đặt: nút quay lại (‹) trên màn hình đó cũng về thẳng màn hình chính
          if (p.to !== '/') markShortcutEntry(p.to)
          // Đổi URL: lớp bên cạnh trở thành lớp chính (dọn lớp cũ ở useLayoutEffect bên dưới, sau khi vẽ xong)
          go(p.to)
        } else {
          setPeer(null)
          resetLayers()
        }
      }, DURATION)
    }

    const onTouchEnd = () => onEnd(false)
    const onTouchCancel = () => onEnd(true)
    box.addEventListener('touchstart', onStart, { passive: true })
    box.addEventListener('touchmove', onMove, { passive: false })
    box.addEventListener('touchend', onTouchEnd)
    box.addEventListener('touchcancel', onTouchCancel)
    return () => {
      box.removeEventListener('touchstart', onStart)
      box.removeEventListener('touchmove', onMove)
      box.removeEventListener('touchend', onTouchEnd)
      box.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [])

  // Giữ nguyên element giữa các lần vẽ lại để kéo không làm vẽ lại cả trang
  const mainEl = useMemo(() => render(), [render])
  const peerTo = peer && peer.to !== pathname ? peer.to : null
  const peerEl = useMemo(() => (peerTo ? render(peerTo) : null), [render, peerTo])

  return (
    <div ref={boxRef} className="relative h-full overflow-hidden">
      <div key={pathname} ref={mainRef} className="absolute inset-0">
        {mainEl}
      </div>
      {peer && peerTo && (
        // Màn hình bên cạnh: nằm sẵn ngay ngoài mép, phía ngược với hướng kéo
        <div key={peerTo} ref={peerRef} className="absolute inset-0" style={{ transform: `translate3d(${-peer.dir * 100}%,0,0)` }} aria-hidden="true">
          {peerEl}
        </div>
      )}
    </div>
  )
}
