import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import { useGarden, useNow } from '../data/GardenContext'
import { errorText, movePot, placePot, storePot } from '../data/api'
import { potKindById, potSetById, slotKey, tierBlock, type OwnedPot } from '../data/pots'
import { isPlaced, potsOnTier } from './potInfo'
import { BTN, InfoPanel, LIST_H, PotList, PotMenu } from './PotUi'
import { EMPTY_PLOT, levelOf, MAX_PLOTS } from '../data/crops'
import { loadTier, MENU_PATH, saveTier, TIER_COUNT, TIER_UNLOCK_LEVEL } from './constants'
import { LandscapeFrame, useLandscape } from './LandscapeFrame'
import { LoadingScreen } from './LoadingScreen'
import type { GameModels, SceneMode } from './TierScene'
import { GachaScreen, ROLL_IMG, STONE_IMG } from './GachaUi'

// Màn hình game Vườn mây: toàn màn hình, luôn nằm ngang (LandscapeFrame), màn hình tải → cảnh 3D xem từng tầng mây.
// Nút thoát (góc trái trên) về menu app Giải trí. Bong bóng thông báo tự ẩn ở đường dẫn game (isGamePath).

const TierScene = lazy(() => import('./TierScene'))
const MIN_LOADING_MS = 1300 // lần mở sau (mô hình đã lưu trong máy) vẫn hiện màn hình tải một chút
const NO_PLOTS = Array.from({ length: MAX_PLOTS }, () => EMPTY_PLOT)
const NO_POTS: OwnedPot[] = []
const NO_PLACED: Record<string, string> = {}

// Đang làm gì với chậu: xem / chọn chậu cho chỗ trống / menu chậu đã đặt (nhấn giữ) / dời chậu
type Ui =
  | { kind: 'view' }
  | { kind: 'place'; slot: number; sel: string | null }
  | { kind: 'menu'; slot: number; confirm: boolean }
  | { kind: 'move'; from: number }

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
  const { garden, actor } = useGarden()
  const { toLocal } = useLandscape()
  const now = useNow(1000)
  const uid = user?.uid ?? ''
  const [tier, setTier] = useState(() => loadTier(uid))
  const [models, setModels] = useState<GameModels | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'loading' | 'fading' | 'ready'>('loading')
  const started = useRef(Date.now())
  const [ui, setUi] = useState<Ui>({ kind: 'view' })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [gacha, setGacha] = useState(false)
  const toastTimer = useRef(0)
  function say(msg: string) {
    setToast(msg); window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }

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
    setUi({ kind: 'view' })
  }

  // ---- Chậu ----
  const pots = garden?.pots ?? NO_POTS
  const placed = garden?.placed ?? NO_PLACED
  const onTier = potsOnTier(pots, placed, tier)
  const blocked = (p: OwnedPot) => (tierBlock(potSetById.get(potKindById.get(p.kind)?.set ?? '')!, tier) ? 1 : 0)
  const inStore = pots
    .filter((p) => !isPlaced(placed, p.id) && potKindById.has(p.kind))
    .sort((a, b) => blocked(a) - blocked(b) || a.kind.localeCompare(b.kind) || b.level - a.level)
  const selPot = ui.kind === 'place' ? pots.find((p) => p.id === ui.sel) ?? null : null
  const mode: SceneMode =
    ui.kind === 'place' ? { kind: 'place', slot: ui.slot, preview: selPot } : ui.kind === 'move' ? { kind: 'move', from: ui.from } : { kind: 'view' }
  async function run(job: () => Promise<unknown>, ok: string) {
    setBusy(true)
    try { await job(); say(ok); setUi({ kind: 'view' }) } catch (err) { say(errorText(err)) } finally { setBusy(false) }
  }
  function onSlotTap(slot: number) {
    if (busy) return
    if (ui.kind === 'move') { const from = ui.from; void run(() => movePot(actor, tier, from, slot), 'Đã dời chậu'); return }
    if (ui.kind === 'view' || ui.kind === 'place') setUi({ kind: 'place', slot, sel: ui.kind === 'place' ? ui.sel : null })
  }
  function onPotHold(slot: number) { if (ui.kind === 'view' && !busy) setUi({ kind: 'menu', slot, confirm: false }) }
  function onEmptyTap() { if (ui.kind === 'place' || ui.kind === 'menu') setUi({ kind: 'view' }) }
  function confirmPlace() {
    if (ui.kind !== 'place' || !selPot) return
    const name = potKindById.get(selPot.kind)?.name ?? 'chậu'
    const { slot } = ui
    void run(() => placePot(actor, tier, slot, selPot.id), `Đã đặt ${name.toLowerCase()}`)
  }
  const menuPot = ui.kind === 'menu' ? pots.find((p) => p.id === placed[slotKey(tier, ui.slot)]) ?? null : null
  const menuHasPlant = ui.kind === 'menu' && tier === 0 && !!garden?.plots[ui.slot]?.crop
  function store() {
    if (ui.kind !== 'menu') return
    if (menuHasPlant && !ui.confirm) { setUi({ ...ui, confirm: true }); return } // chậu có cây: bấm 2 lần
    const { slot } = ui
    void run(() => storePot(actor, tier, slot), 'Đã cất chậu vào kho')
  }

  return (
    <>
      {models && (
        <Suspense fallback={null}>
          <TierScene
            models={models}
            tier={tier}
            tierOpen={!locked}
            toLocal={toLocal}
            plots={garden?.plots ?? NO_PLOTS}
            pots={pots}
            placed={placed}
            now={now}
            mode={mode}
            onSlotTap={onSlotTap}
            onPotHold={onPotHold}
            onEmptyTap={onEmptyTap}
          />
        </Suspense>
      )}

      {/* Nút thoát: luôn có (kể cả khi đang tải), trừ lúc đang đặt / dời chậu */}
      {(ui.kind === 'view' || ui.kind === 'menu') && <button
        type="button"
        data-round
        aria-label="Thoát về menu Giải trí"
        onClick={() => navigate(MENU_PATH)}
        className={`${ROUND_BTN} absolute top-3 z-30 from-slate-400/50 to-slate-600/60`}
        style={{ left: 'calc(var(--safe-l) + 12px)' }}
      >
        <LineIcon icon="logout" className="h-6 w-6 -scale-x-100" />
      </button>}

      {phase !== 'loading' && ui.kind === 'view' && (
        <>
          {/* HUD: giữa = đá vũ trụ; phải = nút gacha (chỉ có icon) */}
          {garden && (
            <div className="pointer-events-none absolute top-3 left-1/2 z-20 flex h-10 -translate-x-1/2 items-center gap-1.5 border border-white/25 bg-black/30 pr-3 pl-1.5 shadow-lg shadow-black/30 backdrop-blur-md">
              <img src={STONE_IMG} alt="" className="h-7 w-7 object-contain" />
              <span className="text-sm font-bold tabular-nums">{garden.stones.toLocaleString('vi-VN')}</span>
            </div>
          )}
          <button
            type="button"
            data-round
            aria-label="Gacha (ước nguyện)"
            onClick={() => setGacha(true)}
            className={`${ROUND_BTN} absolute top-3 z-20 from-amber-400/70 to-fuchsia-600/70`}
            style={{ right: 'calc(var(--safe-r) + 12px)' }}
          >
            <img src={ROLL_IMG.vong_tinh} alt="" className="h-9 w-9 object-contain" />
          </button>
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

      {/* Đặt chậu: danh sách chậu trong kho + bảng hiệu ứng + [huỷ] [đặt] */}
      {phase !== 'loading' && ui.kind === 'place' && (
        <>
          <PotList pots={inStore} onTier={onTier} tier={tier} selected={ui.sel} onSelect={(id) => setUi({ ...ui, sel: id })} />
          <InfoPanel onTier={onTier} sel={selPot} />
          <div className="absolute z-30 flex gap-3" style={{ left: 'calc(var(--safe-l) + 12px)', bottom: LIST_H + 12 }}>
            <button type="button" data-round aria-label="Huỷ đặt chậu" onClick={() => setUi({ kind: 'view' })} className={`${ROUND_BTN} from-sky-500/70 to-blue-600/70`}>
              <LineIcon icon="cancel" className="h-6 w-6" />
            </button>
            <button type="button" data-round aria-label="Đặt chậu" disabled={!selPot || busy} onClick={confirmPlace} className={ROUND_BTN}>
              <LineIcon icon="save" className="h-6 w-6" />
            </button>
          </div>
        </>
      )}

      {/* Dời chậu: chạm vòng trống để dời tới đó */}
      {ui.kind === 'move' && (
        <div className="absolute inset-x-0 top-3 z-30 flex justify-center">
          <div className="flex items-center gap-3 border border-white/25 bg-indigo-950/70 py-2 pr-2 pl-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <p className="text-sm font-semibold">Chạm vào vòng trống để dời chậu tới đó</p>
            <button type="button" className={`${BTN} w-20 from-slate-400/40 to-slate-600/50`} onClick={() => setUi({ kind: 'view' })}>Huỷ</button>
          </div>
        </div>
      )}

      {ui.kind === 'menu' && menuPot && (
        <PotMenu
          pot={menuPot}
          confirm={ui.confirm}
          busy={busy}
          onClose={() => setUi({ kind: 'view' })}
          onMove={() => setUi({ kind: 'move', from: ui.slot })}
          onStore={store}
        />
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 z-50 flex justify-center" style={{ bottom: ui.kind === 'place' ? LIST_H + 72 : 24 }}>
          <p className="border border-white/25 bg-black/60 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md">{toast}</p>
        </div>
      )}

      {gacha && <GachaScreen onClose={() => setGacha(false)} />}

      {phase !== 'ready' && <LoadingScreen progress={progress} error={error} fading={phase === 'fading'} />}
    </>
  )
}
