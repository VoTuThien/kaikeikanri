import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import { useGarden } from '../data/GardenContext'
import { levelOf } from '../data/crops'
import { loadTier, MENU_PATH, saveTier, TIER_COUNT, TIER_UNLOCK_LEVEL } from './constants'
import { LandscapeFrame, useLandscape } from './LandscapeFrame'
import { LoadingScreen } from './LoadingScreen'
import type { GameModels } from './TierScene'

// Màn hình game Vườn mây: toàn màn hình, luôn nằm ngang (LandscapeFrame), màn hình tải → cảnh 3D xem từng tầng mây.
// Nút thoát (góc trái trên) về menu app Giải trí. Bong bóng thông báo tự ẩn ở đường dẫn game (isGamePath).

const TierScene = lazy(() => import('./TierScene'))
const MIN_LOADING_MS = 1300 // lần mở sau (mô hình đã lưu trong máy) vẫn hiện màn hình tải một chút

export function GamePage() {
  return (
    <LandscapeFrame>
      <Game />
    </LandscapeFrame>
  )
}

// Nút tròn kiểu kính (giống FAB) dùng cho các nút trong game
const ROUND_BTN =
  'flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-gradient-to-br from-fuchsia-500/70 to-indigo-500/70 shadow-lg shadow-black/40 backdrop-blur-xl transition active:scale-90 disabled:opacity-35 disabled:active:scale-100'

function Game() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { garden } = useGarden()
  const { toLocal } = useLandscape()
  const uid = user?.uid ?? ''
  const [tier, setTier] = useState(() => loadTier(uid))
  const [models, setModels] = useState<GameModels | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'loading' | 'fading' | 'ready'>('loading')
  const started = useRef(Date.now())

  // Tải: mã cảnh 3D (10%) → mô hình (90%, theo dung lượng đã tải); giữ màn hình tải tối thiểu MIN_LOADING_MS
  useEffect(() => {
    let alive = true
    started.current = Date.now()
    import('./TierScene')
      .then((mod) => { if (alive) setProgress(0.1); return mod.loadGameModels((p) => alive && setProgress(0.1 + 0.9 * p)) })
      .then((m) => {
        if (!alive) return
        setModels(m)
        const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - started.current))
        window.setTimeout(() => { if (!alive) return; setPhase('fading'); window.setTimeout(() => alive && setPhase('ready'), 500) }, wait)
      })
      .catch((err) => { console.error(err); if (alive) setError('Không tải được dữ liệu game. Kiểm tra mạng rồi thoát ra vào lại.') })
    return () => { alive = false }
  }, [])

  const level = garden ? levelOf(garden.xp) : 1
  const need = TIER_UNLOCK_LEVEL[tier]
  const locked = level < need
  function go(d: number) {
    const n = Math.max(0, Math.min(TIER_COUNT - 1, tier + d))
    setTier(n); if (uid) saveTier(uid, n)
  }

  return (
    <>
      {models && (
        <Suspense fallback={null}>
          <TierScene models={models} tier={tier} toLocal={toLocal} />
        </Suspense>
      )}

      {/* Nút thoát: luôn có, kể cả khi đang tải */}
      <button
        type="button"
        data-round
        aria-label="Thoát về menu Giải trí"
        onClick={() => navigate(MENU_PATH)}
        className={`${ROUND_BTN} absolute top-3 z-30 from-slate-400/50 to-slate-600/60`}
        style={{ left: 'calc(var(--safe-l) + 12px)' }}
      >
        <LineIcon icon="logout" className="h-6 w-6 -scale-x-100" />
      </button>

      {phase !== 'loading' && (
        <>
          {/* Chuyển tầng: ▲ ▼ xếp dọc ở mép phải, giữa ghi "Tầng n/4" */}
          <div className="absolute top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2" style={{ right: 'calc(var(--safe-r) + 12px)' }}>
            <button type="button" data-round aria-label="Lên tầng trên" disabled={tier >= TIER_COUNT - 1} onClick={() => go(1)} className={`${ROUND_BTN} text-xl`}>
              ▲
            </button>
            <div className="flex w-16 flex-col items-center border border-white/25 bg-black/25 px-1 py-1.5 text-center shadow-lg shadow-black/30 backdrop-blur-md">
              <span className="text-[11px] leading-4 text-white/70">Tầng</span>
              <span className="flex items-center gap-1 text-base leading-5 font-bold">
                {locked && <Icon3D emoji="🔒" className="h-4 w-4" />}
                {tier + 1}/{TIER_COUNT}
              </span>
            </div>
            <button type="button" data-round aria-label="Xuống tầng dưới" disabled={tier <= 0} onClick={() => go(-1)} className={`${ROUND_BTN} text-xl`}>
              ▼
            </button>
          </div>

          {/* Tầng đang khoá: ổ khoá + điều kiện mở */}
          {locked && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
              <div className="flex items-center gap-3 border border-white/25 bg-indigo-950/70 px-5 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <Icon3D emoji="🔒" className="h-8 w-8 text-amber-200" />
                <div>
                  <p className="text-base leading-6 font-semibold">Tầng {tier + 1} đang khoá</p>
                  <p className="text-sm leading-5 text-white/75">
                    Mở khoá ở cấp {need} · bạn đang cấp {level}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {phase !== 'ready' && <LoadingScreen progress={progress} error={error} fading={phase === 'fading'} />}
    </>
  )
}
