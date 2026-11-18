import { lazy, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell } from '../../components/PageShell'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Skeleton } from '../../components/ui/Skeleton'
import { CropBlock, GardenStats, GardenStatsSkeleton } from './components'
import { buyPlot, errorText, harvest, harvestAll, plant, tend, tendAll } from './data/api'
import { CROPS, formatCoins, formatGrow, formatLeft, levelOf, MAX_PLOTS, plotPrice, plotState, type PlotState } from './data/crops'
import { useGarden, useNow } from './data/GardenContext'

// Màn hình Vườn: lưới 12 ô đất (4 cột × 3 hàng). Chạm 1 ô làm đúng việc ô đó đang cần:
// đất trống -> chọn hạt để gieo; cây khát nước / có sâu -> tưới + bắt sâu; cây chín -> thu hoạch;
// ô khoá đầu tiên -> chạm 2 lần để mở bằng xu.

const COLS = 'grid grid-cols-4 gap-2'
const MSG = 'h-10' // dòng thông báo dưới lưới (2 dòng chữ nhỏ)
const STAGE_ICON = ['🫘', '🌱', '🌿', '🌿']

type Msg = { type: 'ok' | 'error'; text: string } | null

// Cảnh 3D các tầng mây (xoay / phóng to được), tải riêng cùng thư viện 3D
const CloudScene = lazy(() => import('./models/CloudScene'))

// 2 chế độ xem: cảnh mây 3D / lưới ô đất; nhớ lựa chọn trong máy
type View = 'scene' | 'plots'
const VIEWS: { value: View; label: string }[] = [
  { value: 'scene', label: 'Cảnh mây' },
  { value: 'plots', label: 'Ô đất' },
]
const VIEW_KEY = 'garden-view'
function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'plots' ? 'plots' : 'scene'
  } catch {
    return 'scene'
  }
}
function saveView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // trình duyệt chặn lưu: bỏ qua
  }
}
// Khung cảnh 3D chiếm phần chiều cao còn lại của trang
const SCENE_BOX = 'relative min-h-0 flex-1 !shrink overflow-hidden border border-white/20 shadow-2xl shadow-black/30'

export function FarmPage() {
  const { loading, garden, actor } = useGarden()
  const now = useNow(1000)
  const [picking, setPicking] = useState<number | null>(null) // ô đang chọn hạt
  const [confirmBuy, setConfirmBuy] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [view, setView] = useState<View>(loadView)

  // Thông báo tự tắt sau vài giây
  useEffect(() => {
    if (!msg) return
    const t = window.setTimeout(() => setMsg(null), 4000)
    return () => window.clearTimeout(t)
  }, [msg])

  if (loading || !garden) return <FarmPageSkeleton />

  const level = levelOf(garden.xp)
  const states = garden.plots.map((p, i) => (i < garden.unlocked ? plotState(p, now) : null))
  const anyRipe = states.some((s) => s?.ripe)
  const anyCare = states.some((s) => s && (s.thirsty || s.hasBug))

  async function run(key: string, action: () => Promise<Msg>) {
    if (busy) return
    setBusy(key)
    try {
      setMsg(await action())
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  // Câu báo sau khi thu hoạch (kèm lên cấp + cây mới mở khoá)
  const harvestMsg = ({ count, before, after }: { count: number; before: number; after: number }): Msg => {
    if (!count) return { type: 'error', text: 'Chưa có cây nào chín.' }
    if (after > before) {
      const unlocked = CROPS.filter((c) => c.level > before && c.level <= after).map((c) => c.name)
      return {
        type: 'ok',
        text: `Thu hoạch ${count} nông sản. Lên cấp ${after}!${unlocked.length ? ` Mở khoá: ${unlocked.join(', ')}.` : ''}`,
      }
    }
    return { type: 'ok', text: `Thu hoạch ${count} nông sản, đã cất vào kho.` }
  }

  function tap(index: number) {
    if (index >= garden!.unlocked) {
      if (index !== garden!.unlocked) return
      if (!confirmBuy) {
        setConfirmBuy(true)
        return
      }
      setConfirmBuy(false)
      run('buy', () =>
        buyPlot(actor).then(() => ({
          type: 'ok',
          text: 'Đã mở thêm 1 ô đất.',
        })),
      )
      return
    }
    setConfirmBuy(false)
    const st = states[index]
    if (!st) return setPicking(index)
    if (st.ripe) return run(`p${index}`, () => harvest(actor, index).then(harvestMsg))
    if (st.thirsty || st.hasBug) {
      const what = [st.thirsty && 'tưới nước', st.hasBug && 'bắt sâu'].filter(Boolean).join(' và ')
      return run(`p${index}`, () =>
        tend(actor, index).then(() => ({
          type: 'ok',
          text: `Đã ${what} cho ${st.crop!.name}.`,
        })),
      )
    }
    setMsg({
      type: 'ok',
      text: `${st.crop!.name} còn ${formatLeft(st.leftMs)} nữa thì chín.`,
    })
  }

  function choose(cropId: string) {
    const index = picking
    setPicking(null)
    if (index === null) return
    const crop = CROPS.find((c) => c.id === cropId)!
    run(`p${index}`, () =>
      plant(actor, index, cropId).then(() => ({
        type: 'ok',
        text: `Đã gieo ${crop.name} (−${crop.seedPrice} xu).`,
      })),
    )
  }

  return (
    <PageShell>
      <AppHeader title="Vườn của tôi" backTo="/garden" />
      <GardenStats garden={garden} />
      <Segmented
        options={VIEWS}
        value={view}
        onChange={(v) => {
          setView(v)
          saveView(v)
        }}
      />
      {view === 'scene' ? (
        <div data-no-swipe className={SCENE_BOX}>
          <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <CloudScene />
          </Suspense>
          <p className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs text-white/60">Kéo để xoay · 2 ngón để phóng to</p>
        </div>
      ) : (
        <GlassPanel className="!p-2.5">
          <div data-no-swipe className={COLS}>
            {garden.plots.map((_, i) => (
              <PlotTile
                key={i}
                state={states[i]}
                locked={i >= garden.unlocked}
                next={i === garden.unlocked}
                confirm={confirmBuy && i === garden.unlocked}
                price={plotPrice(i)}
                busy={busy === `p${i}` || (busy === 'buy' && i === garden.unlocked)}
                onTap={() => tap(i)}
              />
            ))}
          </div>
        </GlassPanel>
      )}
      <p className={`${MSG} line-clamp-2 pr-36 pl-1 text-sm leading-5 ${msg?.type === 'error' ? 'text-rose-200' : 'text-white/80'}`} role="status">
        {msg?.text ?? (view === 'scene' ? 'Gieo, tưới, thu hoạch ở tab Ô đất.' : 'Chạm ô đất để chăm cây. Ô khoá: chạm 2 lần để mở.')}
      </p>

      <FabGroup>
        <Fab
          icon="water"
          label="Tưới và bắt sâu cả vườn"
          variant="secondary"
          disabled={!anyCare}
          loading={busy === 'tend'}
          onClick={() =>
            run('tend', () =>
              tendAll(actor).then((n) => ({
                type: 'ok',
                text: `Đã chăm ${n} cây.`,
              })),
            )
          }
        />
        <Fab
          icon="harvest"
          label="Thu hoạch tất cả"
          disabled={!anyRipe}
          loading={busy === 'harvest'}
          onClick={() => run('harvest', () => harvestAll(actor).then(harvestMsg))}
        />
      </FabGroup>

      {picking !== null && <SeedPicker level={level} coins={garden.coins} onPick={choose} onClose={() => setPicking(null)} />}
    </PageShell>
  )
}

// ---- 1 ô đất ----
const TILE =
  'relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden border shadow-md shadow-black/30 transition active:scale-95'
const SOIL = 'border-amber-200/25 bg-gradient-to-b from-amber-700/55 to-amber-950/70'

function PlotTile({
  state,
  locked,
  next,
  confirm,
  price,
  busy,
  onTap,
}: {
  state: PlotState | null
  locked: boolean
  next: boolean
  confirm: boolean
  price: number
  busy: boolean
  onTap: () => void
}) {
  if (locked) {
    return (
      <button
        type="button"
        onClick={onTap}
        disabled={!next}
        className={`${TILE} gap-0.5 border-white/15 bg-white/5 ${next ? '' : 'opacity-40'} ${confirm ? 'ring-2 ring-yellow-200' : ''}`}
        aria-label={next ? `Ô đất khoá, mở với ${price} xu` : 'Ô đất khoá'}
      >
        <Icon3D emoji="🔒" className="h-6 w-6 text-white/70" />
        {next && <span className="text-[11px] leading-4 font-semibold text-yellow-100">{confirm ? 'Mở?' : `${formatCoins(price)} xu`}</span>}
      </button>
    )
  }

  if (!state) {
    return (
      <button type="button" onClick={onTap} className={`${TILE} ${SOIL}`} aria-label="Đất trống, chạm để gieo hạt">
        {busy ? <Spinner /> : <span className="text-2xl leading-none font-light text-white/40">+</span>}
      </button>
    )
  }

  const { crop, ripe, stage, progress, leftMs, thirsty, hasBug } = state
  return (
    <button
      type="button"
      onClick={onTap}
      className={`${TILE} ${ripe ? `border-white/40 bg-gradient-to-br ${crop!.color} ring-2 ring-yellow-200/70` : SOIL}`}
      aria-label={ripe ? `${crop!.name} đã chín, chạm để thu hoạch` : `${crop!.name}, còn ${formatLeft(leftMs)}`}
    >
      {busy ? (
        <Spinner />
      ) : (
        <Icon3D
          emoji={ripe ? crop!.icon : STAGE_ICON[stage]}
          className={ripe ? 'h-10 w-10 animate-[bounce_2s_ease-in-out_infinite]' : 'h-9 w-9 text-lime-200'}
        />
      )}
      <span className="mt-0.5 h-4 w-full truncate px-1 text-center text-[11px] leading-4 font-semibold">
        {ripe ? 'Thu hoạch' : formatLeft(leftMs)}
      </span>
      {/* Huy hiệu việc cần làm ở góc phải trên */}
      <span className="absolute top-1 right-1 flex gap-0.5">
        {thirsty && <Badge icon="💧" color="bg-sky-500/90" />}
        {hasBug && <Badge icon="🐛" color="bg-rose-500/90" />}
      </span>
      {!ripe && (
        <span className="absolute inset-x-1.5 bottom-1 h-1 bg-black/30">
          <span className="block h-full bg-lime-300" style={{ width: `${progress * 100}%` }} />
        </span>
      )}
    </button>
  )
}

const Badge = ({ icon, color }: { icon: string; color: string }) => (
  <span className={`flex h-5 w-5 items-center justify-center ${color} shadow shadow-black/40`}>
    <Icon3D emoji={icon} className="h-3.5 w-3.5" />
  </span>
)

const Spinner = () => <span data-round className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />

// ---- Popup chọn hạt để gieo ----
function SeedPicker({ level, coins, onPick, onClose }: { level: number; coins: number; onPick: (id: string) => void; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return createPortal(
    <div
      data-no-swipe
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Chọn hạt giống"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-white/20 bg-indigo-950/85 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <h2 className="mb-3 flex items-center justify-between text-base leading-6 font-semibold">
          Chọn hạt giống
          <span className="flex items-center gap-1 text-sm text-yellow-100">
            <Icon3D emoji="🪙" className="h-4 w-4" /> {formatCoins(coins)}
          </span>
        </h2>
        <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto">
          {CROPS.map((c) => {
            const lockedCrop = level < c.level
            const poor = coins < c.seedPrice
            return (
              <button
                key={c.id}
                type="button"
                disabled={lockedCrop || poor}
                onClick={() => onPick(c.id)}
                className="flex h-16 items-center gap-2 border border-white/15 bg-white/10 px-2 text-left transition enabled:active:scale-95 disabled:opacity-45"
              >
                <CropBlock icon={c.icon} color={c.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold">{c.name}</span>
                  <span className="block truncate text-xs leading-4 text-white/70">
                    {lockedCrop ? `Cần cấp ${c.level}` : `${c.seedPrice} xu · ${formatGrow(c.minutes)}`}
                  </span>
                  <span className="block truncate text-xs leading-4 text-white/50">
                    Thu {c.yield} × {c.sellPrice} xu
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 h-12 w-full border border-white/25 bg-white/10 text-sm font-semibold transition active:scale-95"
        >
          Đóng
        </button>
      </div>
    </div>,
    document.body,
  )
}

export function FarmPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GardenStatsSkeleton />
      <SegmentedSkeleton count={VIEWS.length} />
      {loadView() === 'scene' ? (
        <Skeleton className={`${SCENE_BOX} rounded-none`} />
      ) : (
        <GlassPanel className="!p-2.5">
          <div className={COLS}>
            {Array.from({ length: MAX_PLOTS }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        </GlassPanel>
      )}
      <Skeleton className={`${MSG} w-full`} />
      <FabSkeleton count={2} />
    </PageShell>
  )
}
