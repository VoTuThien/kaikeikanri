// Đập chậu (nâng cấp chậu có tỉ lệ, xem CLAUDE.md "Nâng cấp chậu có tỉ lệ"): luật + tính tỉ lệ. Ghi dữ liệu ở `upgradePot` (data/api.ts).
import { potKindById, potSetById, type OwnedPot, type Rank } from './pots'

export const MAX_POT_LEVEL = 6
export const MAX_FODDER = 5 // tối đa 5 chậu bỏ vào
export const MAX_LUCK = 3 // tối đa 3 bùa may mắn / lần (trộn hạng được)

// Tỉ lệ thành công gốc theo hạng chậu, chỉ số = cấp hiện tại − 1 (1→2 … 5→6)
const BASE_RATE: Record<Rank, number[]> = {
  B: [0.9, 0.75, 0.6, 0.45, 0.3],
  A: [0.8, 0.65, 0.5, 0.35, 0.2],
  S: [0.7, 0.55, 0.4, 0.25, 0.12],
}
// Trần tỉ lệ: chậu S luôn còn rủi ro
const CAP: Record<Rank, number> = { B: 1, A: 1, S: 0.95 }
// % cộng của 1 chậu bỏ vào theo hạng + cấp của CHẬU BỎ VÀO; cùng loại với chậu đang nâng ×1,5
const FODDER_BONUS: Record<Rank, number[]> = {
  B: [0.02, 0.03, 0.04, 0.06, 0.08, 0.1],
  A: [0.04, 0.06, 0.08, 0.12, 0.16, 0.2],
  S: [0.08, 0.12, 0.16, 0.24, 0.32, 0.4],
}
export const SAME_KIND_MULT = 1.5

// Bùa: may mắn B / A / S cộng tỉ lệ; giữ cấp = thất bại thì luôn giữ nguyên cấp (1 ô riêng, tối đa 1)
export type CharmId = 'B' | 'A' | 'S' | 'keep'
// img: public/game/bua/<id>.webp (design/vuon-may/scripts/bua.py); icon = icon nét dự phòng
export const CHARMS: { id: CharmId; name: string; icon: string; img: string; bonus: number; note: string }[] = [
  { id: 'B', name: 'Bùa may mắn B', icon: '🍀', img: '/game/bua/B.webp', bonus: 0.05, note: '+5% tỉ lệ thành công' },
  { id: 'A', name: 'Bùa may mắn A', icon: '🍀', img: '/game/bua/A.webp', bonus: 0.12, note: '+12% tỉ lệ thành công' },
  { id: 'S', name: 'Bùa may mắn S', icon: '🍀', img: '/game/bua/S.webp', bonus: 0.25, note: '+25% tỉ lệ thành công' },
  { id: 'keep', name: 'Bùa giữ cấp', icon: '🔒', img: '/game/bua/keep.webp', bonus: 0, note: 'Thất bại thì luôn giữ nguyên cấp' },
]
export const charmById = new Map(CHARMS.map((c) => [c.id, c]))
export const CHARM_SHOP_PRICE = 100 // bùa may mắn B: lông chim / bùa (cửa hàng)
export type Charms = Record<CharmId, number>
export const NO_CHARMS: Charms = { B: 0, A: 0, S: 0, keep: 0 }

// Thất bại: 10% về lv1, 70% giữ nguyên, 20% tuột ngẫu nhiên 1–4 cấp (không dưới lv1)
export const FAIL_SPLIT = { reset: 0.1, keep: 0.7, drop: 0.2 }

// Côn trùng của từng bộ chậu (2 loại, theo chủ đề) — mỗi lần thử tốn N con MỖI loại
export const UPGRADE_INSECTS: Record<string, [string, string]> = {
  dat_nung: ['sau', 'bo_rua'],
  may_tre: ['nhen', 'sau'],
  bien_ca: ['bo_rua', 'dom_dom'],
  rung_nam: ['sau', 'dom_dom'],
  trung_thu: ['dom_dom', 'buom'],
  mat_ong: ['buom', 'bo_rua'],
  thien_ha: ['dom_dom', 'nhen'],
  su_lam: ['buom', 'nhen'],
  bang_tinh: ['nhen', 'bo_rua'],
  phuong_hoang: ['dom_dom', 'buom'],
}
const COST_INSECTS = [2, 3, 4, 5, 6] // mỗi loại, theo cấp hiện tại 1…5
const COST_FEATHERS = [30, 60, 120, 200, 300]
const RANK_MULT: Record<Rank, number> = { B: 1, A: 1.5, S: 2 }

export const potRank = (kind: string): Rank => potSetById.get(potKindById.get(kind)?.set ?? '')?.rank ?? 'B'
const potSetId = (kind: string) => potKindById.get(kind)?.set ?? ''

// Chi phí 1 lần thử nâng chậu đang ở cấp `level`
export function upgradeCost(pot: OwnedPot) {
  const i = Math.max(0, Math.min(4, pot.level - 1))
  const m = RANK_MULT[potRank(pot.kind)]
  const each = Math.ceil(COST_INSECTS[i] * m)
  const insects: Record<string, number> = {}
  for (const id of UPGRADE_INSECTS[potSetId(pot.kind)] ?? ['sau', 'bo_rua']) insects[id] = (insects[id] ?? 0) + each
  return { insects, feathers: Math.ceil(COST_FEATHERS[i] * m) }
}

export const baseRate = (pot: OwnedPot) => BASE_RATE[potRank(pot.kind)][Math.max(0, Math.min(4, pot.level - 1))]
export function fodderBonus(fodder: OwnedPot, target: OwnedPot) {
  const b = FODDER_BONUS[potRank(fodder.kind)][Math.max(0, Math.min(5, fodder.level - 1))]
  return fodder.kind === target.kind ? b * SAME_KIND_MULT : b
}
export function luckBonus(luck: { B: number; A: number; S: number }) {
  return luck.B * charmById.get('B')!.bonus + luck.A * charmById.get('A')!.bonus + luck.S * charmById.get('S')!.bonus
}
// Tỉ lệ thành công cuối cùng + các phần cộng
export function upgradeRate(target: OwnedPot, fodder: OwnedPot[], luck: { B: number; A: number; S: number }) {
  const base = baseRate(target)
  const pots = fodder.reduce((s, f) => s + fodderBonus(f, target), 0)
  const charms = luckBonus(luck)
  const cap = CAP[potRank(target.kind)]
  return { base, pots, charms, cap, total: Math.min(cap, base + pots + charms) }
}

export type UpgradeOutcome = 'up' | 'keep' | 'reset' | 'drop' | 'held'
// Quay kết quả. `keepCharm` = có bùa giữ cấp. Trả về cấp mới + kiểu kết quả.
export function rollUpgrade(level: number, rate: number, keepCharm: boolean, rnd: () => number = Math.random): { level: number; outcome: UpgradeOutcome } {
  if (rnd() < rate) return { level: Math.min(MAX_POT_LEVEL, level + 1), outcome: 'up' }
  if (keepCharm) return { level, outcome: 'held' }
  const r = rnd()
  if (r < FAIL_SPLIT.reset) return { level: 1, outcome: level > 1 ? 'reset' : 'keep' }
  if (r < FAIL_SPLIT.reset + FAIL_SPLIT.keep || level <= 1) return { level, outcome: 'keep' }
  const n = 1 + Math.floor(rnd() * Math.min(4, level - 1))
  return { level: Math.max(1, level - n), outcome: 'drop' }
}

// Chậu bỏ vào cần bấm 2 lần xác nhận: hạng S, cấp ≥ 3, hoặc bản cuối cùng của loại đó (sau khi bỏ hết các chậu đã chọn)
export function riskyFodder(fodder: OwnedPot[], all: OwnedPot[]) {
  const out: { pot: OwnedPot; why: string }[] = []
  const removed = new Set(fodder.map((p) => p.id))
  for (const f of fodder) {
    const left = all.filter((p) => p.kind === f.kind && !removed.has(p.id)).length
    const why = potRank(f.kind) === 'S' ? 'chậu hạng S' : f.level >= 3 ? `chậu cấp ${f.level}` : left === 0 ? 'chậu cuối cùng của loại này' : ''
    if (why) out.push({ pot: f, why })
  }
  return out
}
