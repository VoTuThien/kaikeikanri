import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isGamePath } from '../pages/garden/game/constants'
import { db } from '../lib/firebase'

// Báo có bản cập nhật của app (PWA, `registerType: 'prompt'` trong vite.config.ts):
// service worker mới tải xong thì KHOÁ màn hình bằng hộp "Đã có phiên bản mới · Tải lại" (người dùng phải bấm tải lại, không lờ đi được).
// Kiểm tra bản mới: REALTIME khi deploy xong (Firestore `appMeta/version`), khi mở app, khi quay lại app (visibilitychange) và mỗi 30 phút.
// `UpdateWatcher` gắn 1 lần trong App.tsx; thanh vẽ ở `UpdateBar` (ngoài game: cố định trên màn hình; trong game: vẽ trong khung game ngang).

const CHECK_MS = 30 * 60 * 1000
let state = { need: false, update: () => {} }
const subs = new Set<() => void>()
const setState = (s: typeof state) => { state = s; subs.forEach((f) => f()) }
const useUpdateState = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state)

export function UpdateWatcher() {
  const regRef = useRef<ServiceWorkerRegistration | null>(null)
  const { needRefresh: [need], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return
      regRef.current = reg
      window.setInterval(() => { void reg.update() }, CHECK_MS)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update() })
    },
  })
  useEffect(() => { setState({ need, update: () => { void updateServiceWorker(true) } }) }, [need, updateServiceWorker])

  // Lắng nghe REALTIME `appMeta/version` (npm run deploy ghi sau khi deploy, scripts/publish-version.mjs): mã khác bản đang chạy
  // → bảo service worker tải bản mới ngay (xong thì `need` bật → khoá màn hình). Thử lại vài lần vì file mới có thể chưa tới kịp.
  const needRef = useRef(need)
  needRef.current = need
  useEffect(() => {
    if (!db || import.meta.env.DEV) return
    let timer = 0
    const unsub = onSnapshot(doc(db, 'appMeta', 'version'), (snap) => {
      const v = snap.get('version') as string | undefined
      if (snap.metadata.fromCache || !v || v === __APP_VERSION__) return
      window.clearTimeout(timer)
      let tries = 0
      const check = () => {
        if (needRef.current) return
        void regRef.current?.update()
        if (++tries < 6) timer = window.setTimeout(check, 15_000)
      }
      check()
    }, () => { /* chưa đọc được (vd chưa deploy Rules): bỏ qua, vẫn còn kiểm tra khi mở / quay lại app */ })
    return () => { unsub(); window.clearTimeout(timer) }
  }, [])
  return <UpdateBar />
}

// Có bản mới: KHOÁ cả màn hình (nền tối che hết, chặn mọi thao tác) cho tới khi người chơi bấm "Tải lại" — không cho lờ đi / chơi tiếp bản cũ.
export function UpdateBar({ inGame = false }: { inGame?: boolean }) {
  const { need, update } = useUpdateState()
  const { pathname } = useLocation()
  const [busy, setBusy] = useState(false)
  if (!need || (!inGame && isGamePath(pathname))) return null
  const reload = () => {
    if (busy) return
    setBusy(true)
    update()
    window.setTimeout(() => window.location.reload(), 3000) // dự phòng: service worker mới không tự tải lại trang
  }
  return (
    <div
      className={`${inGame ? 'absolute' : 'fixed'} inset-0 z-[200] flex items-center justify-center bg-black/75 p-6 backdrop-blur-md`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-title"
      data-no-swipe
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex w-[min(360px,100%)] flex-col items-center gap-3 border border-white/25 bg-indigo-950/90 px-6 py-5 text-center shadow-2xl shadow-black/60">
        <p id="update-title" className="text-lg leading-6 font-semibold">Đã có phiên bản mới</p>
        <p className="text-sm leading-5 text-white/75">Tải lại để dùng phiên bản mới nhất rồi tiếp tục nhé.</p>
        <button type="button" disabled={busy} onClick={reload}
          className="mt-1 h-11 w-full border border-white/30 bg-gradient-to-br from-fuchsia-500/80 to-indigo-500/80 text-base font-semibold shadow-lg shadow-black/40 active:scale-95 disabled:opacity-60">
          {busy ? 'Đang tải lại…' : 'Tải lại'}
        </button>
      </div>
    </div>
  )
}
