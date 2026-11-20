import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isGamePath } from '../pages/garden/game/constants'

// Báo có bản cập nhật của app (PWA, `registerType: 'prompt'` trong vite.config.ts):
// service worker mới tải xong thì hiện thanh nhỏ "Có bản cập nhật · Tải lại" (KHÔNG tự tải lại, để khỏi mất thông tin đang nhập).
// Kiểm tra bản mới khi mở app, khi quay lại app (visibilitychange) và mỗi 30 phút.
// `UpdateWatcher` gắn 1 lần trong App.tsx; thanh vẽ ở `UpdateBar` (ngoài game: cố định trên màn hình; trong game: vẽ trong khung game ngang).

const CHECK_MS = 30 * 60 * 1000
let state = { need: false, update: () => {} }
const subs = new Set<() => void>()
const setState = (s: typeof state) => { state = s; subs.forEach((f) => f()) }
const useUpdateState = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state)

export function UpdateWatcher() {
  const { needRefresh: [need], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return
      window.setInterval(() => { void reg.update() }, CHECK_MS)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update() })
    },
  })
  useEffect(() => { setState({ need, update: () => { void updateServiceWorker(true) } }) }, [need, updateServiceWorker])
  return <UpdateBar />
}

export function UpdateBar({ inGame = false }: { inGame?: boolean }) {
  const { need, update } = useUpdateState()
  const { pathname } = useLocation()
  if (!need || (!inGame && isGamePath(pathname))) return null
  return (
    <div
      className={`${inGame ? 'absolute' : 'fixed'} left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 border border-white/25 bg-indigo-950/80 py-1.5 pr-1.5 pl-3 text-sm shadow-2xl shadow-black/50 backdrop-blur-xl`}
      style={{ top: inGame ? 64 : 'max(0.5rem, env(safe-area-inset-top))' }}
      role="status"
    >
      <span className="font-semibold">Có bản cập nhật</span>
      <button type="button" onClick={update} className="h-8 border border-white/30 bg-gradient-to-br from-fuchsia-500/80 to-indigo-500/80 px-3 text-sm font-semibold active:scale-95">
        Tải lại
      </button>
    </div>
  )
}
