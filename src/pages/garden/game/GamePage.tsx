import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import { useGarden, useNow } from '../data/GardenContext'
import { catchInsect, errorText, harvestPlant, movePot, placePot, sow, storePot, water } from '../data/api'
import { potKindById, potSetById, slotKey, tierBlock, type OwnedPot } from '../data/pots'
import { isPlaced, potsOnTier } from './potInfo'
import { BTN, InfoPanel, LIST_H, PotList, PotMenu } from './PotUi'
import { cropById, formatLeft, levelOf, levelProgress, plantState, seedImage, type Crop, type Plant } from '../data/crops'
import { insectById } from '../data/gacha'
import { loadMenuOpen, loadTier, MENU_PATH, saveMenuOpen, saveTier, TIER_COUNT, TIER_UNLOCK_LEVEL } from './constants'
import { LandscapeFrame, useLandscape } from './LandscapeFrame'
import { LoadingScreen } from './LoadingScreen'
import type { GameModels, SceneMode } from './TierScene'
import { FEATHER_IMG, GachaScreen, ROLL_IMG, STONE_IMG } from './GachaUi'
import { SeedList } from './SeedUi'
import { BagPopup, GuidePopup, ShopPopup } from './GardenPopups'
import { AchievementsScreen } from './AchievementsUi'
import { readyTotal } from '../data/achievements'

// Màn hình game Vườn mây: toàn màn hình, luôn nằm ngang (LandscapeFrame), màn hình tải → cảnh 3D xem từng tầng mây.
// Nút thoát (góc trái trên) về menu app Giải trí. Bong bóng thông báo tự ẩn ở đường dẫn game (isGamePath).
// GĐ4: chạm chậu trống → danh sách hạt → gieo + túi hạt lơ lửng (kéo lướt qua chậu trống để gieo tiếp);
// chạm cây: chín → thu hoạch, khát → tưới; chạm côn trùng → bắt. Túi đồ, Cửa hàng, Cẩm nang là popup. Tiền trong game: lông chim (+ đá vũ trụ cho gacha).

const TierScene = lazy(() => import('./TierScene'))
const MIN_LOADING_MS = 1300 // lần mở sau (mô hình đã lưu trong máy) vẫn hiện màn hình tải một chút
const NO_POTS: OwnedPot[] = []
const NO_PLACED: Record<string, string> = {}
const NO_PLANTS: Record<string, Plant> = {}

// Đang làm gì: xem / chọn chậu cho chỗ trống / menu chậu đã đặt (nhấn giữ) / dời chậu / chọn hạt cho chậu trống / cầm túi hạt
type Ui =
  | { kind: 'view' }
  | { kind: 'place'; slot: number; sel: string | null }
  | { kind: 'menu'; slot: number; confirm: boolean }
  | { kind: 'move'; from: number }
  | { kind: 'seed'; slot: number }
  | { kind: 'bag'; crop: string; slot: number }

export function GamePage() {
  return (
    <LandscapeFrame>
      <Game />
    </LandscapeFrame>
  )
}

// Nút tròn kiểu kính (giống FAB) dùng cho các nút trong game
// Chấm đỏ ở góc phải trên của nút tròn (có việc chờ: quà chưa nhận…)
function RedDot() {
  return <span data-round aria-hidden className="absolute top-0 right-0 h-3 w-3 rounded-full border-2 border-white/80 bg-rose-500 shadow" />
}

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
  const [popup, setPopupState] = useState<'gacha' | 'bag' | 'guide' | 'shop' | 'ach' | null>(null)
  // Menu ☰: gom các nút bên phải HUD; nhớ đóng / mở; mở 1 popup thì tự đóng menu
  const [menuOpen, setMenuOpenState] = useState(() => loadMenuOpen(uid))
  const setMenuOpen = (open: boolean) => { setMenuOpenState(open); if (uid) saveMenuOpen(uid, open) }
  const setPopup = (p: typeof popup) => { setPopupState(p); if (p) setMenuOpen(false) }
  // Chậu vừa gieo, chưa ghi xong (hiện ngay trên cảnh): key chỗ đặt -> cây
  const [pending, setPendingState] = useState<Record<string, Plant>>({})
  const pendRef = useRef<Record<string, Plant>>({}) // bản đồng bộ của `pending` (kéo túi nhanh hơn React vẽ lại)
  const setPending = (f: (pd: Record<string, Plant>) => Record<string, Plant>) => { pendRef.current = f(pendRef.current); setPendingState(pendRef.current) }
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
  const xpBar = levelProgress(garden?.xp ?? 0)
  // Các nút trong menu ☰ (2 nút / hàng: cẩm nang, cửa hàng / thành tựu, gacha / túi đồ); `dot` = có việc chờ (chấm đỏ)
  const achReady = useMemo(() => (garden ? readyTotal(garden, garden.claimed) : 0), [garden])
  const menuItems: { label: string; popup: NonNullable<typeof popup>; color: string; icon: React.ReactNode; dot: boolean }[] = [
    { label: 'Cẩm nang', popup: 'guide', color: 'from-sky-400/70 to-indigo-600/70', icon: <Icon3D emoji="📖" className="h-6 w-6" />, dot: false },
    { label: 'Cửa hàng', popup: 'shop', color: 'from-rose-400/70 to-pink-600/70', icon: <Icon3D emoji="🛒" className="h-6 w-6" />, dot: false },
    { label: 'Thành tựu', popup: 'ach', color: 'from-amber-400/70 to-orange-600/70', icon: <Icon3D emoji="🏆" className="h-6 w-6" />, dot: achReady > 0 },
    { label: 'Gacha (ước nguyện)', popup: 'gacha', color: 'from-amber-400/70 to-fuchsia-600/70', icon: <img src={ROLL_IMG.vong_tinh} alt="" className="h-9 w-9 object-contain" />, dot: false },
    { label: 'Túi đồ', popup: 'bag', color: 'from-emerald-400/70 to-teal-600/70', icon: <Icon3D emoji="🧺" className="h-6 w-6" />, dot: false },
  ]
  const menuDots = menuItems.filter((m) => m.dot).length
  const need = TIER_UNLOCK_LEVEL[tier]
  const locked = level < need
  function go(d: number) {
    const n = Math.max(0, Math.min(TIER_COUNT - 1, tier + d))
    setTier(n); if (uid) saveTier(uid, n)
    setUi({ kind: 'view' }) // túi hạt biến mất khi chuyển tầng
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
    ui.kind === 'place' ? { kind: 'place', slot: ui.slot, preview: selPot }
      : ui.kind === 'move' ? { kind: 'move', from: ui.from }
        : ui.kind === 'seed' ? { kind: 'seed', slot: ui.slot }
          : { kind: 'view' }
  async function run(job: () => Promise<unknown>, ok: string) {
    setBusy(true)
    try { await job(); say(ok); setUi({ kind: 'view' }) } catch (err) { say(errorText(err)) } finally { setBusy(false) }
  }

  // ---- Cây ----
  const realPlants = garden?.plants ?? NO_PLANTS
  const plants = useMemo(() => ({ ...realPlants, ...pending }), [realPlants, pending])
  const pendingOf = (crop: string) => Object.entries(pendRef.current).filter(([k, p]) => p.crop === crop && !realPlants[k]).length
  const seedsLeft = (crop: string) => Math.max(0, (garden?.seeds[crop] ?? 0) - pendingOf(crop))
  const seedsView = useMemo(() => {
    const out: Record<string, number> = { ...(garden?.seeds ?? {}) }
    for (const [k, p] of Object.entries(pending)) if (!realPlants[k]) out[p.crop] = Math.max(0, (out[p.crop] ?? 0) - 1)
    return out
  }, [garden?.seeds, pending, realPlants])
  // Đã ghi xong / snapshot mới có cây thì bỏ khỏi `pending`
  useEffect(() => {
    setPending((pd) => {
      const keys = Object.keys(pd).filter((k) => realPlants[k])
      if (!keys.length) return pd
      const n = { ...pd }; keys.forEach((k) => delete n[k]); return n
    })
  }, [realPlants])

  // Gieo (hiện ngay) vào chậu trống `slot` của tầng đang xem; trả về false nếu hết hạt
  const sowQueue = useRef<{ crop: string; slots: number[] }>({ crop: '', slots: [] })
  function sowLocal(crop: string, slot: number) {
    const key = slotKey(tier, slot)
    if (!placed[key] || realPlants[key] || pendRef.current[key]) return true
    if (seedsLeft(crop) <= 0) return false
    setPending((pd) => ({ ...pd, [key]: { crop, plantedAt: Date.now(), watered: false, caught: false } }))
    if (sowQueue.current.crop !== crop) sowQueue.current = { crop, slots: [] }
    sowQueue.current.slots.push(slot)
    return true
  }
  // Ghi các chậu đã gieo trong 1 lần (1 transaction)
  function flushSow() {
    const { crop, slots } = sowQueue.current
    sowQueue.current = { crop, slots: [] }
    if (!slots.length) return
    const t = tier
    const drop = () => setPending((pd) => { const n = { ...pd }; slots.forEach((s) => delete n[slotKey(t, s)]); return n })
    sow(actor, t, slots, crop)
      .then(() => window.setTimeout(drop, 1500)) // chậu không gieo được (hết hạt…) thì biến mất; chậu đã gieo đã có trong dữ liệu thật
      .catch((err) => { say(errorText(err)); drop() })
  }
  function chooseSeed(crop: Crop) {
    if (ui.kind !== 'seed') return
    const slot = ui.slot
    if (!sowLocal(crop.id, slot)) { say(`Hết hạt ${crop.name.toLowerCase()}`); return }
    flushSow()
    if (seedsLeft(crop.id) <= 0) { say(`Đã gieo ${crop.name.toLowerCase()} · hết hạt`); setUi({ kind: 'view' }); return }
    setUi({ kind: 'bag', crop: crop.id, slot })
  }
  function onBagOver(slot: number) {
    if (ui.kind !== 'bag') return
    if (!sowLocal(ui.crop, slot)) return
    setUi({ ...ui, slot })
  }
  function onBagRelease() {
    flushSow()
  }
  // Hết hạt khi đang cầm túi → túi biến mất
  const bagCrop = ui.kind === 'bag' ? ui.crop : null
  const bagLeft = bagCrop ? seedsLeft(bagCrop) : 0
  useEffect(() => {
    if (bagCrop && bagLeft <= 0) {
      flushSow()
      say(`Hết hạt ${cropById.get(bagCrop)?.name.toLowerCase() ?? ''}`)
      setUi({ kind: 'view' })
    }
  }, [bagCrop, bagLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(job: () => Promise<string>) {
    if (busy) return
    setBusy(true)
    try { say(await job()) } catch (err) { say(errorText(err)) } finally { setBusy(false) }
  }
  function onPotTap(slot: number, insect: boolean) {
    const key = slotKey(tier, slot)
    const p = plants[key]
    if (ui.kind === 'move') return
    if (ui.kind === 'bag') {
      if (!p) { sowLocal(ui.crop, slot); flushSow(); setUi({ ...ui, slot }); return }
      setUi({ kind: 'view' })
    }
    if (ui.kind === 'place' || ui.kind === 'menu') { setUi({ kind: 'view' }); return }
    if (!p) { setUi({ kind: 'seed', slot }); return }
    if (pending[key] && !realPlants[key]) return // vừa gieo, chưa ghi xong
    const st = plantState(p, Date.now())
    if (!st?.crop) return
    const name = st.crop.name.toLowerCase()
    if (insect && st.insect) {
      void act(async () => {
        const r = await catchInsect(actor, tier, slot)
        const what = `Bắt được ${insectById.get(r.id)?.name.toLowerCase() ?? 'côn trùng'}!`
        return r.after > r.before ? `${what} · lên cấp ${r.after}!` : `${what} · +${r.xp} kinh nghiệm`
      })
    } else if (st.ripe) {
      void act(async () => {
        const r = await harvestPlant(actor, tier, slot)
        return r.after > r.before ? `+${r.count} ${name} · lên cấp ${r.after}!` : `+${r.count} ${name} · +${r.xp} kinh nghiệm`
      })
    } else if (st.thirsty) {
      void act(async () => { await water(actor, tier, slot); return `Đã tưới ${name}: thu thêm 1 khi chín` })
    } else {
      say(`${st.crop.name} chín sau ${formatLeft(st.leftMs)}`)
    }
  }
  function onSlotTap(slot: number) {
    if (busy) return
    if (ui.kind === 'move') { const from = ui.from; void run(() => movePot(actor, tier, from, slot), 'Đã dời chậu'); return }
    if (ui.kind === 'view' || ui.kind === 'place' || ui.kind === 'bag' || ui.kind === 'seed') setUi({ kind: 'place', slot, sel: ui.kind === 'place' ? ui.sel : null })
  }
  function onPotHold(slot: number) { if ((ui.kind === 'view' || ui.kind === 'bag') && !busy) setUi({ kind: 'menu', slot, confirm: false }) }
  function onEmptyTap() { if (ui.kind !== 'view' && ui.kind !== 'move') setUi({ kind: 'view' }) }
  function confirmPlace() {
    if (ui.kind !== 'place' || !selPot) return
    const name = potKindById.get(selPot.kind)?.name ?? 'chậu'
    const { slot } = ui
    void run(() => placePot(actor, tier, slot, selPot.id), `Đã đặt ${name.toLowerCase()}`)
  }
  const menuPot = ui.kind === 'menu' ? pots.find((p) => p.id === placed[slotKey(tier, ui.slot)]) ?? null : null
  const menuHasPlant = ui.kind === 'menu' && !!realPlants[slotKey(tier, ui.slot)]
  function store() {
    if (ui.kind !== 'menu') return
    if (menuHasPlant && !ui.confirm) { setUi({ ...ui, confirm: true }); return } // chậu có cây: bấm 2 lần
    const { slot } = ui
    void run(() => storePot(actor, tier, slot), 'Đã cất chậu vào kho')
  }
  const showHud = phase !== 'loading' && (ui.kind === 'view' || ui.kind === 'bag')
  const bagInfo = bagCrop ? cropById.get(bagCrop) : null

  return (
    <>
      {models && (
        <Suspense fallback={null}>
          <TierScene
            models={models}
            tier={tier}
            tierOpen={!locked}
            toLocal={toLocal}
            plants={plants}
            pots={pots}
            placed={placed}
            now={now}
            mode={mode}
            bag={ui.kind === 'bag' ? { crop: ui.crop, slot: ui.slot } : null}
            onSlotTap={onSlotTap}
            onPotTap={onPotTap}
            onPotHold={onPotHold}
            onEmptyTap={onEmptyTap}
            onBagOver={onBagOver}
            onBagRelease={onBagRelease}
          />
        </Suspense>
      )}

      {/* Trái trên: nút thoát + cấp / thanh kinh nghiệm (ẩn khi đang đặt / dời chậu, chọn hạt) */}
      {(ui.kind === 'view' || ui.kind === 'menu' || ui.kind === 'bag') && (
        <div className="absolute top-3 z-30 flex items-center gap-2" style={{ left: 'calc(var(--safe-l) + 12px)' }}>
          <button type="button" data-round aria-label="Thoát về menu Giải trí" onClick={() => navigate(MENU_PATH)} className={`${ROUND_BTN} from-slate-400/50 to-slate-600/60`}>
            <LineIcon icon="logout" className="h-6 w-6 -scale-x-100" />
          </button>
          {garden && phase !== 'loading' && (
            <div className="pointer-events-none flex h-10 w-32 flex-col justify-center border border-white/25 bg-black/30 px-2 shadow-lg shadow-black/30 backdrop-blur-md">
              <span className="text-xs leading-4 font-bold">Cấp {xpBar.level}{xpBar.max && ' · tối đa'}</span>
              <span className="mt-0.5 h-1.5 w-full bg-white/20">
                <span className="block h-full bg-gradient-to-r from-lime-300 to-emerald-500" style={{ width: `${Math.min(100, (xpBar.have / xpBar.need) * 100)}%` }} />
              </span>
            </div>
          )}
        </div>
      )}

      {showHud && (
        <>
          {/* Giữa trên: đá vũ trụ + lông chim (2 ô bằng nhau) */}
          {garden && (
            <div className="pointer-events-none absolute top-3 left-1/2 z-20 grid -translate-x-1/2 grid-cols-2 gap-2">
              {[{ img: STONE_IMG, n: garden.stones, label: 'Đá vũ trụ' }, { img: FEATHER_IMG, n: garden.feathers, label: 'Lông chim' }].map((x) => (
                <div key={x.label} aria-label={x.label} className="flex h-10 w-24 items-center gap-1.5 border border-white/25 bg-black/30 pr-2 pl-1.5 shadow-lg shadow-black/30 backdrop-blur-md">
                  <img src={x.img} alt="" className="h-7 w-7 shrink-0 object-contain" />
                  <span className="truncate text-sm font-bold tabular-nums">{x.n.toLocaleString('vi-VN')}</span>
                </div>
              ))}
            </div>
          )}
          {/* Phải trên: nút menu ☰ (mở / đóng các nút: cẩm nang, cửa hàng, gacha, túi đồ); chấm đỏ = tổng chấm đỏ bên trong */}
          <button
            type="button"
            data-round
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className={`${ROUND_BTN} absolute top-3 z-20 from-violet-500/70 to-indigo-600/70`}
            style={{ right: 'calc(var(--safe-r) + 12px)' }}
          >
            <LineIcon icon={menuOpen ? 'cancel' : 'menu'} className="h-6 w-6" />
            {!menuOpen && menuDots > 0 && <RedDot />}
          </button>
          {/* Menu đang mở: lưới 2 nút / hàng ngay dưới ☰, nằm BÊN TRÁI cột ▲ ▼ để không đè nút chuyển tầng */}
          {menuOpen && (
            <div className="absolute z-20 grid grid-cols-2 gap-2" style={{ top: 'calc(0.75rem + 56px)', right: 'calc(var(--safe-r) + 12px + 72px)' }}>
              {menuItems.map((m) => (
                <button key={m.label} type="button" data-round aria-label={m.label} onClick={() => setPopup(m.popup)} className={`${ROUND_BTN} relative ${m.color}`}>
                  {m.icon}
                  {m.dot && <RedDot />}
                </button>
              ))}
            </div>
          )}
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

      {/* Cầm túi hạt: tên + số hạt còn lại + nút X bỏ túi */}
      {phase !== 'loading' && ui.kind === 'bag' && bagInfo && (
        <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 border border-white/25 bg-indigo-950/70 py-1.5 pr-1.5 pl-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <img src={seedImage(bagInfo.id)} alt="" className="h-10 w-10 object-contain" />
          <div className="min-w-0">
            <p className="text-sm leading-5 font-semibold">{bagInfo.name} · còn {bagLeft} hạt</p>
            <p className="text-xs leading-4 text-white/70">Kéo túi lướt qua chậu trống để gieo</p>
          </div>
          <button type="button" data-round aria-label="Cất túi hạt" onClick={() => setUi({ kind: 'view' })} className={`${ROUND_BTN} h-10 w-10 from-sky-500/70 to-blue-600/70`}>
            <LineIcon icon="cancel" className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Chọn hạt cho chậu trống */}
      {phase !== 'loading' && ui.kind === 'seed' && garden && (
        <>
          <SeedList seeds={seedsView} level={level} onSelect={chooseSeed} />
          <div className="absolute z-30" style={{ left: 'calc(var(--safe-l) + 12px)', bottom: LIST_H + 12 }}>
            <button type="button" data-round aria-label="Huỷ chọn hạt" onClick={() => setUi({ kind: 'view' })} className={`${ROUND_BTN} from-sky-500/70 to-blue-600/70`}>
              <LineIcon icon="cancel" className="h-6 w-6" />
            </button>
          </div>
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
        <div className="pointer-events-none absolute inset-x-0 z-50 flex justify-center" style={{ bottom: ui.kind === 'place' || ui.kind === 'seed' ? LIST_H + 72 : ui.kind === 'bag' ? 84 : 24 }}>
          <p className="border border-white/25 bg-black/60 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md">{toast}</p>
        </div>
      )}

      {popup === 'gacha' && <GachaScreen onClose={() => setPopup(null)} />}
      {popup === 'bag' && garden && <BagPopup garden={garden} actor={actor} onClose={() => setPopup(null)} say={say} />}
      {popup === 'guide' && garden && <GuidePopup garden={garden} onClose={() => setPopup(null)} />}
      {popup === 'ach' && garden && <AchievementsScreen garden={garden} actor={actor} onClose={() => setPopup(null)} />}
      {popup === 'shop' && garden && <ShopPopup garden={garden} actor={actor} onClose={() => setPopup(null)} say={say} />}

      {phase !== 'ready' && <LoadingScreen progress={progress} error={error} fading={phase === 'fading'} />}
    </>
  )
}
