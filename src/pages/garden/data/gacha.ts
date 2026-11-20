import { CROPS, SEED_RANK_RATE } from './crops'
import { POT_SETS, potKindById, type OwnedPot } from './pots'

// Gacha của game Vườn mây (xem CLAUDE.md "Gacha"). Hiện có BANNER CHẬU (banner 2, dùng Vọng Tinh).
// Banner đồ trang trí (banner 1, Sao Duyên) chưa có đồ trang trí nên chưa mở.
// Quay chạy trên điện thoại rồi ghi Firestore trong cùng transaction với việc trừ cục roll (không có máy chủ riêng).

export type RollKind = 'sao_duyen' | 'vong_tinh'
export type Rarity = 'blue' | 'purple' | 'gold'
export const ROLL_PRICE = 16 // đá vũ trụ / cục roll
export const START_STONES = 32
export const GIFT_ROLLS = 20 // quà chào mừng: 20 Vọng Tinh
export const HARD_PITY = 80
export const SOFT_PITY = 60

// Côn trùng (dùng nâng cấp chậu ở GĐ5)
export const INSECTS = [
  { id: 'bo_rua', name: 'Bọ rùa', icon: '🐞' },
  { id: 'sau', name: 'Sâu', icon: '🐛' },
  { id: 'dom_dom', name: 'Đom đóm', icon: '🪲' },
  { id: 'nhen', name: 'Nhện', icon: '🕷' },
  { id: 'buom', name: 'Bươm bướm', icon: '🦋' },
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
export const RATES = { gold: 0.0008, purple: 0.06, potB: 0.14, seeds: 0.3 } // còn lại = côn trùng
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

export type PullItem =
  | { type: 'pot'; rarity: Rarity; kind: string; isNew: boolean; off?: boolean }
  | { type: 'seed'; rarity: 'blue'; crop: string; qty: number }
  | { type: 'insect'; rarity: 'blue'; insect: string }
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

// Quay `count` lần, sửa trực tiếp `state` / `pots` (thêm chậu mới) / `seeds` / `insects`. Trả về các món theo thứ tự.
export function pullMany(
  count: number,
  state: GachaState,
  pots: OwnedPot[],
  seeds: Record<string, number>,
  insects: Record<string, number>,
  bannerSet: string,
  rnd: () => number = Math.random,
): PullItem[] {
  const out: PullItem[] = []
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
      out.push({ type: 'pot', rarity: 'gold', kind, isNew, off })
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
      out.push({ type: 'pot', rarity: 'purple', kind, isNew })
    } else if (r < RATES.purple + RATES.potB) {
      const kind = pick(kindsOf((rank) => rank === 'B'), rnd)
      const isNew = owned(kind) === 0
      addPot(kind)
      out.push({ type: 'pot', rarity: 'blue', kind, isNew })
    } else if (r < RATES.purple + RATES.potB + RATES.seeds) {
      // 10 hạt giống cùng 1 loại: chọn hạng theo SEED_RANK_RATE (hạng chưa có cây thì bỏ), rồi chia đều trong hạng
      const crop = pickSeed(rnd)
      seeds[crop] = (seeds[crop] ?? 0) + 10
      out.push({ type: 'seed', rarity: 'blue', crop, qty: 10 })
    } else {
      const insect = pick(INSECTS, rnd).id
      insects[insect] = (insects[insect] ?? 0) + 1
      out.push({ type: 'insect', rarity: 'blue', insect })
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
    { label: `Côn trùng — ${INSECTS.length} loại`, rate: 1 - RATES.gold - RATES.purple - RATES.potB - RATES.seeds },
  ]
}
export const itemName = (it: PullItem) =>
  it.type === 'pot'
    ? potKindById.get(it.kind)?.name ?? 'Chậu'
    : it.type === 'seed'
      ? `10 hạt ${CROPS.find((c) => c.id === it.crop)?.name.toLowerCase() ?? ''}`
      : insectById.get(it.insect)?.name ?? 'Côn trùng'
