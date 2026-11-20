import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import { useGarden, useNow } from '../data/GardenContext'
import { catchInsect, errorText, harvestPlant, movePot, placePot, sow, storePot, water } from '../data/api'
import { byRank, potKindById, potSetById, slotKey, tierBlock, type OwnedPot } from '../data/pots'
import { isPlaced, potsOnTier } from './potInfo'
import { BTN, InfoPanel, LIST_H, PotList, PotMenu } from './PotUi'
import { canFertilize, cropById, formatLeft, levelOf, levelProgress, plantState, seedImage, type Crop, type Plant } from '../data/crops'
import { insectById } from '../data/gacha'
import { loadMenuOpen, loadTier, MENU_PATH, saveMenuOpen, saveTier, TIER_COUNT, TIER_UNLOCK_LEVEL } from './constants'
import { LandscapeFrame, useLandscape } from './LandscapeFrame'
import { LoadingScreen } from './LoadingScreen'
import type { GameModels, SceneMode } from './TierScene'
import { FEATHER_IMG, GachaScreen, STONE_IMG } from './GachaUi'
import { SeedList } from './SeedUi'
import { BagPopup, GuidePopup, ShopPopup } from './GardenPopups'
import { AchievementsScreen } from './AchievementsUi'
import { readyTotal } from '../data/achievements'
import { mailView, useMailbox } from '../data/mail'
import { MailScreen } from './MailUi'
import { UpgradeScreen } from './UpgradeUi'
import { DailyScreen } from './DailyUi'
import { NewsScreen } from './NewsUi'
import { unseenOf, type ChangelogEntry } from '../data/changelog'
import { loadSeenVersion, saveSeenVersion } from '../data/news'
import { UpdateBar } from '../../../components/UpdatePrompt'
import { dailyView } from '../data/daily'
import { fertById, FERTS, type FertId } from '../data/items'
import { ItemImg } from './ItemImg'
import { fertilize } from '../data/api'
import { SLOTS } from './slots'
import { GLASS_ROUND } from './glass'

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
  | { kind: 'bag'; crop: string; slot: number; fert?: FertId } // túi hạt (crop) hoặc túi phân (fert)
  | { kind: 'fertPick'; slot: number } // chọn loại phân cho cây đang lớn

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

// Cấp độ: số nằm giữa cỏ 4 lá (mỗi lá = 2 thuỳ tròn ghép thành hình tim)
function LevelClover({ level }: { level: number }) {
  const lobes = [45, 135, 225, 315].flatMap((a) => [-26, 26].map((d) => {
    const r = ((a + d) * Math.PI) / 180
    return { x: 20 + Math.cos(r) * 8.6, y: 20 + Math.sin(r) * 8.6 }
  }))
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]">
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="clover-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#bef264" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
        </defs>
        {lobes.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={7.2} fill="url(#clover-g)" stroke="#065f46" strokeWidth={1.2} />)}
        <circle cx={20} cy={20} r={8.5} fill="url(#clover-g)" />
      </svg>
      <span className="relative text-base leading-none font-extrabold tabular-nums [text-shadow:0_1px_2px_rgba(6,78,59,0.95)]">{level}</span>
    </span>
  )
}

const ROUND_BTN = `${GLASS_ROUND} h-12 w-12` // nút tròn kính, không màu riêng (glass.ts)

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
  // "Có gì mới": sau màn hình tải, có bản cập nhật chưa xem (theo tài khoản) thì tự mở
  const [news, setNews] = useState<ChangelogEntry[] | null>(null)
  const newsChecked = useRef(false)
  const started = useRef(Date.now())
  const [ui, setUi] = useState<Ui>({ kind: 'view' })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [popup, setPopupState] = useState<'gacha' | 'bag' | 'guide' | 'shop' | 'ach' | 'mail' | 'upgrade' | 'daily' | null>(null)
  // Menu ☰: gom các nút bên phải HUD; nhớ đóng / mở; mở 1 popup thì tự đóng menu
  const [menuOpen, setMenuOpenState] = useState(() => loadMenuOpen(uid))
  const setMenuOpen = (open: boolean) => { setMenuOpenState(open); if (uid) saveMenuOpen(uid, open) }
  const setPopup = (p: typeof popup) => { setPopupState(p); if (p) setMenuOpen(false) }
  const [upgradeId, setUpgradeId] = useState<string | null>(null) // chậu đang mở màn hình đập chậu
  const openUpgrade = (id: string) => { setUpgradeId(id); setPopup('upgrade') }
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
  useEffect(() => {
    if (phase !== 'ready' || !garden || !uid || newsChecked.current) return
    newsChecked.current = true
    loadSeenVersion(uid)
      .then((seen) => {
        if (seen === null && (!garden.born || garden.born > Date.now() - 3600_000)) { void saveSeenVersion(uid); return } // vườn vừa tạo: người chơi mới
        const list = unseenOf(seen ?? '')
        if (list.length) setNews(list)
      })
      .catch((err) => console.error('Không đọc được bản đã xem', err))
  }, [phase, garden, uid])
  function closeNews() {
    setNews(null)
    if (uid) saveSeenVersion(uid).catch((err) => console.error('Không lưu được bản đã xem', err))
  }

  // Các nút trong menu ☰ (2 nút / hàng: cẩm nang, cửa hàng / thành tựu, gacha / túi đồ); `dot` = có việc chờ (chấm đỏ)
  const achReady = useMemo(() => (garden ? readyTotal(garden, garden.claimed) : 0), [garden])
  const dailyReady = useMemo(() => (garden && uid ? dailyView(uid, garden).ready : 0), [garden, uid, now]) // eslint-disable-line react-hooks/exhaustive-deps
  const box = useMailbox(uid || null)
  const mailNow = useNow(60_000)
  const mail = useMemo(() => mailView(box.personal, box.broadcasts, garden?.mailClaimed ?? {}, garden?.born ?? 0, mailNow), [box.personal, box.broadcasts, garden?.mailClaimed, garden?.born, mailNow])
  const menuItems: { label: string; popup: NonNullable<typeof popup>; icon: React.ReactNode; dot: boolean }[] = [
    { label: 'Cẩm nang', popup: 'guide', icon: <Icon3D emoji="📖" className="h-6 w-6" />, dot: false },
    { label: 'Cửa hàng', popup: 'shop', icon: <Icon3D emoji="🛒" className="h-6 w-6" />, dot: false },
    { label: 'Nhiệm vụ hằng ngày', popup: 'daily', icon: <Icon3D emoji="📝" className="h-6 w-6" />, dot: dailyReady > 0 },
    { label: 'Thành tựu', popup: 'ach', icon: <Icon3D emoji="🏆" className="h-6 w-6" />, dot: achReady > 0 },
    { label: 'Gacha (ước nguyện)', popup: 'gacha', icon: <Icon3D emoji="🎲" className="h-6 w-6" />, dot: false },
    { label: 'Hòm thư', popup: 'mail', icon: <Icon3D emoji="📬" className="h-6 w-6" />, dot: mail.unread > 0 },
    { label: 'Túi đồ', popup: 'bag', icon: <Icon3D emoji="🧺" className="h-6 w-6" />, dot: false },
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
  // ---- Phân bón: bón (ghi ngay theo lần kéo túi phân, gom 1 transaction lúc thả tay) ----
  const fertQueue = useRef<{ fert: FertId; slots: number[] }>({ fert: 'B', slots: [] })
  const [fertQueued, setFertQueued] = useState<string[]>([]) // chậu đã bón trong lần kéo (chưa ghi xong)
  const fertLeft = (f: FertId) => Math.max(0, (garden?.ferts[f] ?? 0) - (fertQueue.current.fert === f ? fertQueue.current.slots.length : 0))
  const fertTargets = (tier: number) => SLOTS[tier].map((_, i) => i).filter((i) => {
    const key = slotKey(tier, i)
    return !!placed[key] && !fertQueued.includes(key) && canFertilize(realPlants[key], now)
  })
  function fertLocal(f: FertId, slot: number) {
    const key = slotKey(tier, slot)
    if (fertQueued.includes(key) || !canFertilize(realPlants[key], Date.now())) return true
    if (fertLeft(f) <= 0) return false
    if (fertQueue.current.fert !== f) fertQueue.current = { fert: f, slots: [] }
    fertQueue.current.slots.push(slot)
    setFertQueued((q) => [...q, key])
    return true
  }
  function flushFert() {
    const { fert, slots } = fertQueue.current
    fertQueue.current = { fert, slots: [] }
    if (!slots.length) return
    const t = tier
    const keys = slots.map((s) => slotKey(t, s))
    fertilize(actor, t, slots, fert)
      .then((r) => say(`Đã bón ${r.n} cây · bớt ${formatLeft(r.cutMs)}`))
      .catch((err) => say(errorText(err)))
      .finally(() => setFertQueued((q) => q.filter((k) => !keys.includes(k))))
  }
  function chooseFert(f: FertId) {
    if (ui.kind !== 'fertPick') return
    const slot = ui.slot
    if (!fertLocal(f, slot)) { say(`Hết ${fertById.get(f)!.name.toLowerCase()}`); return }
    flushFert()
    if (fertLeft(f) <= 0) { setUi({ kind: 'view' }); return }
    setUi({ kind: 'bag', crop: '', slot, fert: f })
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
    if (ui.fert ? !fertLocal(ui.fert, slot) : !sowLocal(ui.crop, slot)) return
    setUi({ ...ui, slot })
  }
  function onBagRelease() {
    if (ui.kind === 'bag' && ui.fert) flushFert()
    else flushSow()
  }
  // Hết hạt khi đang cầm túi → túi biến mất
  const bagCrop = ui.kind === 'bag' && !ui.fert ? ui.crop : null
  const bagLeft = bagCrop ? seedsLeft(bagCrop) : 0
  const bagFert = ui.kind === 'bag' ? ui.fert ?? null : null
  const bagFertLeft = bagFert ? fertLeft(bagFert) : 0
  // Hết phân khi đang cầm túi phân → túi biến mất
  useEffect(() => {
    if (bagFert && bagFertLeft <= 0) { flushFert(); setUi({ kind: 'view' }) }
  }, [bagFert, bagFertLeft]) // eslint-disable-line react-hooks/exhaustive-deps
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
    if (ui.kind === 'bag' && ui.fert) {
      if (canFertilize(realPlants[key], Date.now()) && !insect) { fertLocal(ui.fert, slot); flushFert(); setUi({ ...ui, slot }); return }
      setUi({ kind: 'view' })
    } else if (ui.kind === 'bag') {
      if (!p) { sowLocal(ui.crop, slot); flushSow(); setUi({ ...ui, slot }); return }
      setUi({ kind: 'view' })
    }
    if (ui.kind === 'place' || ui.kind === 'menu' || ui.kind === 'fertPick') { setUi({ kind: 'view' }); return }
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
    } else if (canFertilize(p, Date.now()) && FERTS.some((f) => (garden?.ferts[f.id] ?? 0) > 0)) {
      setUi({ kind: 'fertPick', slot }) // cây đang lớn (đã tưới) + có phân: chọn phân để bón
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
  const pickPlant = ui.kind === 'fertPick' ? realPlants[slotKey(tier, ui.slot)] : undefined
  const pickState = pickPlant ? plantState(pickPlant, now) : null

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
            bag={ui.kind === 'bag' ? { crop: ui.crop, slot: ui.slot, fert: ui.fert, targets: ui.fert ? fertTargets(tier) : undefined } : null}
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
          <button type="button" data-round aria-label="Thoát về menu Giải trí" onClick={() => navigate(MENU_PATH)} className={`${ROUND_BTN}`}>
            <LineIcon icon="logout" className="h-6 w-6 -scale-x-100" />
          </button>
          {garden && phase !== 'loading' && (
            <div className="pointer-events-none flex items-center gap-1.5" aria-label={`Cấp ${xpBar.level}${xpBar.max ? ', tối đa' : ''}`}>
              <LevelClover level={xpBar.level} />
              <span className="h-1.5 w-20 bg-black/35 shadow shadow-black/40">
                <span className="block h-full bg-gradient-to-r from-lime-300 to-emerald-500" style={{ width: `${xpBar.max ? 100 : Math.min(100, (xpBar.have / xpBar.need) * 100)}%` }} />
              </span>
            </div>
          )}
        </div>
      )}

      {showHud && (
        <>
          {/* Phải trên, sát bên trái nút ☰: đá vũ trụ + lông chim (không khung, nền game tối nên chữ vẫn rõ) */}
          {garden && (
            <div className="pointer-events-none absolute top-3 z-20 flex h-12 items-center gap-3" style={{ right: 'calc(var(--safe-r) + 12px + 48px + 10px)' }}>
              {[{ img: STONE_IMG, n: garden.stones, label: 'Đá vũ trụ' }, { img: FEATHER_IMG, n: garden.feathers, label: 'Lông chim' }].map((x) => (
                <div key={x.label} aria-label={x.label} className="flex items-center gap-1">
                  <img src={x.img} alt="" className="h-7 w-7 shrink-0 object-contain" />
                  <span className="text-sm font-bold tabular-nums [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">{x.n.toLocaleString('vi-VN')}</span>
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
            className={`${ROUND_BTN} absolute top-3 z-20`}
            style={{ right: 'calc(var(--safe-r) + 12px)' }}
          >
            <LineIcon icon={menuOpen ? 'cancel' : 'menu'} className="h-6 w-6" />
            {!menuOpen && menuDots > 0 && <RedDot />}
          </button>
          {/* Menu đang mở: lưới 2 nút / hàng ngay dưới ☰, nằm BÊN TRÁI cột ▲ ▼ để không đè nút chuyển tầng */}
          {menuOpen && (
            <div className="absolute z-20 grid grid-cols-2 gap-2" style={{ top: 'calc(0.75rem + 56px)', right: 'calc(var(--safe-r) + 12px + 72px)' }}>
              {menuItems.map((m) => (
                <button key={m.label} type="button" data-round aria-label={m.label} onClick={() => setPopup(m.popup)} className={`${ROUND_BTN} relative`}>
                  {m.icon}
                  {m.dot && <RedDot />}
                </button>
              ))}
            </div>
          )}
          {/* Chuyển tầng: ▲ ▼ xếp dọc ở mép phải, giữa là 4 ô vuông báo tầng đang xem */}
          <div className="absolute top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2" style={{ right: 'calc(var(--safe-r) + 12px)' }}>
            <button type="button" data-round aria-label="Lên tầng trên" disabled={tier >= TIER_COUNT - 1} onClick={() => go(1)} className={`${ROUND_BTN} text-xl`}>
              ▲
            </button>
            {/* 4 ô vuông nhỏ xếp thành ô lớn rộng bằng nút ▲: đang ở tầng n thì n ô đầu sáng (trái → phải, trên → dưới), còn lại mờ */}
            <div role="img" aria-label={`Tầng ${tier + 1}/${TIER_COUNT}${locked ? ' (đang khoá)' : ''}`} className="grid h-8 w-8 grid-cols-2 grid-rows-2 gap-[3px]">
              {Array.from({ length: TIER_COUNT }, (_, i) => {
                const on = i <= tier
                const cur = i === tier
                return (
                  <span key={i} className={`flex items-center justify-center border shadow shadow-black/40 ${
                    on ? 'border-amber-100/90 bg-gradient-to-br from-amber-200/90 to-orange-400/80 shadow-[0_0_8px_rgba(253,211,77,0.55)]' : 'border-white/25 bg-white/10 opacity-50'
                  }`}>
                    {cur && locked && <Icon3D emoji="🔒" className="h-2.5 w-2.5 text-indigo-950" />}
                  </span>
                )
              })}
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
          <button type="button" data-round aria-label="Cất túi hạt" onClick={() => setUi({ kind: 'view' })} className={`${GLASS_ROUND} h-10 w-10`}>
            <LineIcon icon="cancel" className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Cầm túi phân: loại phân + số túi còn lại + nút X */}
      {phase !== 'loading' && ui.kind === 'bag' && bagFert && (
        <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 border border-white/25 bg-indigo-950/70 py-1.5 pr-1.5 pl-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <ItemImg img={fertById.get(bagFert)!.img} emoji={fertById.get(bagFert)!.icon} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="text-sm leading-5 font-semibold">{fertById.get(bagFert)!.name} · còn {bagFertLeft} túi</p>
            <p className="text-xs leading-4 text-white/70">Kéo túi lướt qua cây đang lớn để bón (−{Math.round(fertById.get(bagFert)!.cut * 100)}% thời gian)</p>
          </div>
          <button type="button" data-round aria-label="Cất túi phân" onClick={() => setUi({ kind: 'view' })} className={`${GLASS_ROUND} h-10 w-10`}>
            <LineIcon icon="cancel" className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Chọn phân cho cây đang lớn */}
      {phase !== 'loading' && ui.kind === 'fertPick' && garden && pickState?.crop && pickPlant && (
        <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 border border-white/25 bg-indigo-950/75 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="w-40 min-w-0 px-1">
            <p className="truncate text-sm leading-5 font-semibold">{pickState.crop.name} · chín sau {formatLeft(pickState.leftMs)}</p>
            <p className="text-[11px] leading-4 text-white/65">Đã bón {pickPlant.fert ?? 0}/2 lần · chọn phân để bón</p>
          </div>
          {byRank(FERTS, (f) => f.id).map((f) => {
            const have = garden.ferts[f.id]
            const cut = Math.min(f.cut, 0.6 - (pickPlant.boost ?? 0), 1 - pickState.progress) * pickState.crop!.minutes * 60_000
            return (
              <button key={f.id} type="button" disabled={have <= 0} onClick={() => chooseFert(f.id)}
                className={`${BTN} h-12 w-36 flex-col gap-0 px-1 leading-4 ${f.id === 'A' ? 'from-amber-500/70 to-fuchsia-600/70' : 'from-lime-500/60 to-emerald-700/70'}`}>
                <span className="flex items-center gap-1"><ItemImg img={f.img} emoji={f.icon} className="h-5 w-5" />{f.name} ×{have}</span>
                <span className="text-[11px] font-normal text-white/80">bớt {formatLeft(cut)}</span>
              </button>
            )
          })}
          <button type="button" data-round aria-label="Huỷ bón phân" onClick={() => setUi({ kind: 'view' })} className={`${GLASS_ROUND} h-10 w-10`}>
            <LineIcon icon="cancel" className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Chọn hạt cho chậu trống */}
      {phase !== 'loading' && ui.kind === 'seed' && garden && (
        <>
          <SeedList seeds={seedsView} level={level} onSelect={chooseSeed} />
          <div className="absolute z-30" style={{ left: 'calc(var(--safe-l) + 12px)', bottom: LIST_H + 12 }}>
            <button type="button" data-round aria-label="Huỷ chọn hạt" onClick={() => setUi({ kind: 'view' })} className={`${ROUND_BTN}`}>
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
            <button type="button" data-round aria-label="Huỷ đặt chậu" onClick={() => setUi({ kind: 'view' })} className={`${ROUND_BTN}`}>
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
          onUpgrade={() => { const id = menuPot.id; setUi({ kind: 'view' }); openUpgrade(id) }}
          onStore={store}
        />
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 z-50 flex justify-center" style={{ bottom: ui.kind === 'place' || ui.kind === 'seed' ? LIST_H + 72 : ui.kind === 'bag' || ui.kind === 'fertPick' ? 84 : 24 }}>
          <p className="border border-white/25 bg-black/60 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md">{toast}</p>
        </div>
      )}

      {popup === 'gacha' && <GachaScreen onClose={() => setPopup(null)} />}
      {popup === 'bag' && garden && <BagPopup garden={garden} actor={actor} onClose={() => setPopup(null)} say={say} onUpgrade={openUpgrade} />}
      {popup === 'guide' && garden && <GuidePopup garden={garden} onClose={() => setPopup(null)} />}
      {popup === 'upgrade' && garden && upgradeId && <UpgradeScreen garden={garden} actor={actor} potId={upgradeId} onClose={() => setPopup(null)} />}
      {news && <NewsScreen entries={news} onClose={closeNews} />}
      {phase === 'ready' && <UpdateBar inGame />}
      {popup === 'daily' && garden && <DailyScreen garden={garden} actor={actor} onClose={() => setPopup(null)} />}
      {popup === 'mail' && <MailScreen list={mail.list} isOpen={mail.open} actor={actor} onClose={() => setPopup(null)} />}
      {popup === 'ach' && garden && <AchievementsScreen garden={garden} actor={actor} onClose={() => setPopup(null)} />}
      {popup === 'shop' && garden && <ShopPopup garden={garden} actor={actor} onClose={() => setPopup(null)} say={say} />}

      {phase !== 'ready' && <LoadingScreen progress={progress} error={error} fading={phase === 'fading'} />}
    </>
  )
}
