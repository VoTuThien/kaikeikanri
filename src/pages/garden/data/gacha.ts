import { CROPS, SEED_RANK_RATE } from './crops'
import { POT_SETS, potKindById, type OwnedPot } from './pots'
import { charmById, type CharmId, type Charms } from './upgrade'
import { fertById, type FertId, type Ferts, type Shards } from './items'

// Gacha của game Vườn mây (xem CLAUDE.md "Gacha"). Hiện có BANNER CHẬU (banner 2, dùng Vọng Tinh).
// Banner đồ trang trí (banner 1, Vọng Nguyệt) chưa có đồ trang trí nên chưa mở.
// Quay chạy trên điện thoại rồi ghi Firestore trong cùng transaction với việc trừ cục roll (không có máy chủ riêng).

export type RollKind = 'sao_duyen' | 'vong_tinh'
export type Rarity = 'blue' | 'purple' | 'gold'
export const ROLL_PRICE = 16 // đá vũ trụ / cục roll
export const START_STONES = 32
export const GIFT_ROLLS = 20 // quà chào mừng: 20 Vọng Tinh
export const HARD_PITY = 80
export const SOFT_PITY = 60

// Côn trùng (dùng nâng cấp chậu ở GĐ5). img = icon chụp từ mô hình Blender (public/game/contrung/), icon = icon nét dự phòng
export const INSECTS = [
  { id: 'bo_rua', name: 'Bọ rùa', icon: '🐞', img: '/game/contrung/bo_rua.webp' },
  { id: 'sau', name: 'Sâu', icon: '🐛', img: '/game/contrung/sau.webp' },
  { id: 'dom_dom', name: 'Đom đóm', icon: '🪲', img: '/game/contrung/dom_dom.webp' },
  { id: 'nhen', name: 'Nhện', icon: '🕷', img: '/game/contrung/nhen.webp' },
  { id: 'buom', name: 'Bươm bướm', icon: '🦋', img: '/game/contrung/buom.webp' },
]
export const insectById = new Map(INSECTS.map((i) => [i.id, i]))

// Lịch banner chậu: mỗi tháng 1 bộ hạng S, xoay vòng theo thứ tự (thêm bộ banner mới vào cuối danh sách)
export const BANNER_SETS = ['phuong_hoang']
// Vàng "ngoài banner" (lệch rate): các bộ S không nằm trong lịch banner
export const OFF_SETS = POT_SETS.filter((s) => s.rank === 'S' && !BANNER_SETS.includes(s.id)).map((s) => s.id)
const BANNER_EPOCH = 2026 * 12 + 10 // tháng 11/2026 = banner đầu tiên
export function bannerOf(date = new Date()) {
  const m = date.getFullYear() * 12 + date.getMonth()
  const idx = (((m - BANNER_EPOCH) % BANNER_SETS.length) + BANNER_SETS.length) % BANNER_SETS.length
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return { setId: BANNER_SETS[idx], month: `${date.getMonth() + 1}/${date.getFullYear()}`, end }
}

// Tỉ lệ (mỗi lần quay)
export const RATES = { gold: 0.0008, purple: 0.06, potB: 0.14, seeds: 0.3 } // còn lại = suất "vật phẩm" bên dưới + côn trùng
// Suất vật phẩm (lấy từ phần côn trùng ~50%): bùa B 5%, A 0,9%, S 0,1%, giữ cấp 0,5%; phân bón B 6% (5 túi), A 2% (2 túi) → côn trùng còn ≈ 35,4%
export const ITEM_RATES: { kind: 'charm' | 'fert'; id: string; rate: number; qty: number; rarity: Rarity }[] = [
  { kind: 'charm', id: 'S', rate: 0.001, qty: 1, rarity: 'gold' },
  { kind: 'charm', id: 'A', rate: 0.009, qty: 1, rarity: 'purple' },
  { kind: 'charm', id: 'keep', rate: 0.005, qty: 1, rarity: 'purple' },
  { kind: 'charm', id: 'B', rate: 0.05, qty: 1, rarity: 'blue' },
  { kind: 'fert', id: 'A', rate: 0.02, qty: 2, rarity: 'purple' },
  { kind: 'fert', id: 'B', rate: 0.06, qty: 5, rarity: 'blue' },
]
const ITEMS_TOTAL = ITEM_RATES.reduce((s, x) => s + x.rate, 0)

// Mảnh vỡ sao ĐI KÈM món hiếm (không phải món rơi riêng), theo độ hiếm thật của món
export function shardsFor(it: PullItem): Partial<Shards> {
  if (it.type === 'pot') {
    if (it.rarity === 'gold') return { sao_sang: it.isNew ? 10 : 15 }
    if (it.rarity === 'purple') return { sao: it.isNew ? 5 : 8 }
    return {}
  }
  if (it.type === 'charm') return it.charm === 'S' ? { sao_sang: 3 } : it.charm === 'A' ? { sao: 2 } : {}
  if (it.type === 'seed') {
    const rank = CROPS.find((c) => c.id === it.crop)?.rank
    return rank === 'S' ? { sao_sang: 1 } : rank === 'A' ? { sao: 1 } : {}
  }
  return {}
}
// Tỉ lệ vàng theo số lần quay kể từ lần ra vàng gần nhất (n tính cả lần này, bắt đầu từ 1)
export function goldRate(n: number) {
  if (n >= HARD_PITY) return 1
  if (n >= 64) return Math.min(1, 0.1 + 0.06 * (n - 63))
  if (n >= SOFT_PITY) return 0.1
  return RATES.gold
}

export interface GachaState {
  sinceGold: number // số lần quay từ lần ra vàng gần nhất
  sincePurple: number // số lần quay từ lần ra tím / vàng gần nhất (bảo đảm tím trong 10 lần)
  insured: boolean // lần vàng trước bị lệch → lần vàng tới chắc chắn là chậu MỚI của bộ banner
  total: number
}
export const EMPTY_GACHA: GachaState = { sinceGold: 0, sincePurple: 0, insured: false, total: 0 }

export type PullItem = (
  | { type: 'pot'; rarity: Rarity; kind: string; isNew: boolean; off?: boolean }
  | { type: 'seed'; rarity: 'blue'; crop: string; qty: number }
  | { type: 'insect'; rarity: 'blue'; insect: string }
  | { type: 'charm'; rarity: Rarity; charm: CharmId; qty: number }
  | { type: 'fert'; rarity: Rarity; fert: FertId; qty: number }
) & { shards?: Partial<Shards> } // mảnh vỡ sao đi kèm
export interface PullLog { at: number; item: PullItem }

const pick = <T,>(arr: T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)]
// Tỉ lệ thật của từng hạng hạt (đã chia lại phần của hạng chưa có cây)
export function seedRankRates() {
  const ranks = (['B', 'A', 'S'] as const).filter((r) => CROPS.some((c) => c.rank === r))
  const sum = ranks.reduce((a, r) => a + SEED_RANK_RATE[r], 0)
  return ranks.map((r) => ({ rank: r, rate: SEED_RANK_RATE[r] / sum, crops: CROPS.filter((c) => c.rank === r) }))
}
function pickSeed(rnd: () => number) {
  const rates = seedRankRates()
  let r = rnd()
  for (const x of rates) { if (r < x.rate) return pick(x.crops, rnd).id; r -= x.rate }
  return pick(rates[rates.length - 1].crops, rnd).id
}
const kindsOf = (pred: (rank: string, id: string) => boolean) => POT_SETS.filter((s) => pred(s.rank, s.id)).flatMap((s) => s.kinds)

// Túi đồ mà gacha cộng vào (sửa trực tiếp)
export interface PullBag { pots: OwnedPot[]; seeds: Record<string, number>; insects: Record<string, number>; charms: Charms; ferts: Ferts; shards: Shards }
// Quay `count` lần, sửa trực tiếp `state` + túi đồ `bag` (thêm chậu, hạt, côn trùng, bùa, phân, mảnh sao). Trả về các món theo thứ tự.
export function pullMany(count: number, state: GachaState, bag: PullBag, bannerSet: string, rnd: () => number = Math.random): PullItem[] {
  const { pots, seeds, insects } = bag
  const out: PullItem[] = []
  const push = (it: PullItem) => {
    const sh = shardsFor(it)
    if (sh.sao_sang || sh.sao) { it.shards = sh; bag.shards.sao_sang += sh.sao_sang ?? 0; bag.shards.sao += sh.sao ?? 0 }
    out.push(it)
  }
  const owned = (kind: string) => pots.filter((p) => p.kind === kind).length
  const addPot = (kind: string) => pots.push({ id: `r${Date.now().toString(36)}${Math.floor(rnd() * 1e6).toString(36)}${pots.length}`, kind, level: 1 })
  const banner = POT_SETS.find((s) => s.id === bannerSet)!
  for (let i = 0; i < count; i++) {
    state.total += 1
    const n = state.sinceGold + 1
    if (rnd() < goldRate(n)) {
      // ---- VÀNG ----
      state.sinceGold = 0
      state.sincePurple = 0
      // "vòng" của bộ: chậu ít bản nhất là chậu MỚI (đủ bộ rồi thì bản thứ 2 chưa có cũng tính là mới)
      const counts = banner.kinds.map(owned)
      const min = Math.min(...counts)
      const fresh = banner.kinds.filter((_, k) => counts[k] === min)
      const dups = banner.kinds.filter((_, k) => counts[k] > min)
      let kind: string
      let off = false
      const r = rnd()
      if (!state.insured && r < 0.33 && OFF_SETS.length) {
        kind = pick(kindsOf((_, id) => OFF_SETS.includes(id)), rnd)
        off = true
      } else if (!state.insured && r < 0.66 && dups.length) {
        kind = pick(dups, rnd)
        off = true
      } else {
        kind = pick(fresh, rnd)
      }
      state.insured = off
      const isNew = owned(kind) === 0
      addPot(kind)
      push({ type: 'pot', rarity: 'gold', kind, isNew, off })
      continue
    }
    state.sinceGold = n
    state.sincePurple += 1
    const r = rnd() * (1 - RATES.gold)
    if (state.sincePurple >= 10 || r < RATES.purple) {
      // ---- TÍM: chậu hạng A ----
      state.sincePurple = 0
      const kind = pick(kindsOf((rank) => rank === 'A'), rnd)
      const isNew = owned(kind) === 0
      addPot(kind)
      push({ type: 'pot', rarity: 'purple', kind, isNew })
    } else if (r < RATES.purple + RATES.potB) {
      const kind = pick(kindsOf((rank) => rank === 'B'), rnd)
      const isNew = owned(kind) === 0
      addPot(kind)
      push({ type: 'pot', rarity: 'blue', kind, isNew })
    } else if (r < RATES.purple + RATES.potB + RATES.seeds) {
      // 10 hạt giống cùng 1 loại: chọn hạng theo SEED_RANK_RATE (hạng chưa có cây thì bỏ), rồi chia đều trong hạng
      const crop = pickSeed(rnd)
      seeds[crop] = (seeds[crop] ?? 0) + 10
      push({ type: 'seed', rarity: 'blue', crop, qty: 10 })
    } else if (r < RATES.purple + RATES.potB + RATES.seeds + ITEMS_TOTAL) {
      // vật phẩm: bùa / phân bón
      let x = r - RATES.purple - RATES.potB - RATES.seeds
      const it = ITEM_RATES.find((y) => { if (x < y.rate) return true; x -= y.rate; return false }) ?? ITEM_RATES[ITEM_RATES.length - 1]
      if (it.kind === 'charm') {
        bag.charms[it.id as CharmId] += it.qty
        push({ type: 'charm', rarity: it.rarity, charm: it.id as CharmId, qty: it.qty })
      } else {
        bag.ferts[it.id as FertId] += it.qty
        push({ type: 'fert', rarity: it.rarity, fert: it.id as FertId, qty: it.qty })
      }
    } else {
      const insect = pick(INSECTS, rnd).id
      insects[insect] = (insects[insect] ?? 0) + 1
      push({ type: 'insect', rarity: 'blue', insect })
    }
  }
  return out
}

// Bảng tỉ lệ hiện trong màn hình banner
export function rateRows() {
  const nA = kindsOf((r) => r === 'A').length
  const nB = kindsOf((r) => r === 'B').length
  return [
    { label: 'Chậu hạng S (vàng)', rate: RATES.gold, note: 'Tăng từ lần 60, chắc chắn ở lần 80' },
    { label: `Chậu hạng A (tím) — ${nA} loại`, rate: RATES.purple, note: '10 lần quay chắc chắn có ≥ 1 tím' },
    { label: `Chậu hạng B — ${nB} loại`, rate: RATES.potB },
    ...seedRankRates().map((x) => ({ label: `10 hạt giống hạng ${x.rank} — ${x.crops.length} loại`, rate: RATES.seeds * x.rate })),
    ...ITEM_RATES.map((x) => ({ label: x.kind === 'charm' ? `${charmById.get(x.id as CharmId)?.name}` : `${x.qty} túi ${fertById.get(x.id as FertId)?.name.replace('Phân', 'phân')}`, rate: x.rate })),
    { label: `Côn trùng — ${INSECTS.length} loại`, rate: 1 - RATES.gold - RATES.purple - RATES.potB - RATES.seeds - ITEMS_TOTAL },
  ]
}
// Tên gốc + số lượng của 1 món (hiển thị "tên x số lượng", số lượng 1 thì chỉ ghi tên)
export function itemBase(it: PullItem): { name: string; qty: number } {
  if (it.type === 'pot') return { name: potKindById.get(it.kind)?.name ?? 'Chậu', qty: 1 }
  if (it.type === 'seed') return { name: `Hạt ${CROPS.find((c) => c.id === it.crop)?.name.toLowerCase() ?? ''}`, qty: it.qty }
  if (it.type === 'charm') return { name: charmById.get(it.charm)?.name ?? 'Bùa', qty: it.qty }
  if (it.type === 'fert') return { name: fertById.get(it.fert)?.name ?? 'Phân bón', qty: it.qty }
  return { name: insectById.get(it.insect)?.name ?? 'Côn trùng', qty: 1 }
}
export const itemName = (it: PullItem) => { const b = itemBase(it); return b.qty > 1 ? `${b.name} x ${b.qty}` : b.name }
