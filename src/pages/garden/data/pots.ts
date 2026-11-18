// Bộ chậu của game Vườn mây (xem CLAUDE.md "Bộ chậu"): mỗi bộ ≤ 6 chậu khác nhau chung 1 chủ đề, hạng B / A / S cố định theo bộ,
// mỗi chậu có cấp 1–6. Hiệu ứng chỉ áp dụng cho TẦNG đặt bộ chậu, theo số chậu KHÁC NHAU của bộ trên tầng (mốc riêng từng bộ) + cấp trung bình.
// GĐ3 mới hiển thị hiệu ứng (bảng thông tin khi đặt chậu); áp dụng vào luật chơi ở GĐ5.

export type Rank = 'B' | 'A' | 'S'
export type EffectId = 'seed' | 'xp'

export const EFFECTS: Record<EffectId, { name: string; fmt: (v: number) => string }> = {
  seed: { name: 'Hạt rẻ', fmt: (v) => `−${pct(v)}` },
  xp: { name: 'Thêm kinh nghiệm', fmt: (v) => `+${pct(v)}` },
}
const pct = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString('vi-VN')}%`
export const effectText = (e: EffectId, v: number) => `${EFFECTS[e].name} ${EFFECTS[e].fmt(v)}`

// Mức hiệu ứng ở cấp 1 và cấp 6, các cấp giữa tăng đều
export interface Level { lv1: number; lv6: number }
export const valueAt = (l: Level, level: number) => l.lv1 + ((l.lv6 - l.lv1) * (Math.max(1, Math.min(6, level)) - 1)) / 5

export interface PotSet {
  id: string
  name: string
  rank: Rank
  kinds: string[] // các chậu của bộ
  effect: EffectId // hiệu ứng chính
  milestones: (Level & { count: number })[] // mốc theo số chậu khác nhau trên tầng
  bonus: Level & { effect: EffectId } // thưởng đủ bộ
}
export interface PotKind {
  id: string
  set: string
  name: string
  shape: number // dáng chậu đất nung trong `chau-dat-nung.glb` (`ChauDat_<shape>`)
}

export const POT_SETS: PotSet[] = [
  {
    id: 'dat_nung',
    name: 'Đất nung',
    rank: 'B',
    kinds: ['dat_nung_1', 'dat_nung_2', 'dat_nung_3', 'dat_nung_4', 'dat_nung_5', 'dat_nung_6'],
    effect: 'seed',
    milestones: [
      { count: 2, lv1: 2, lv6: 4 },
      { count: 4, lv1: 3, lv6: 8 },
      { count: 6, lv1: 5, lv6: 12 },
    ],
    bonus: { effect: 'xp', lv1: 2, lv6: 5 },
  },
]
export const POT_KINDS: PotKind[] = [
  { id: 'dat_nung_1', set: 'dat_nung', name: 'Chậu tròn', shape: 1 },
  { id: 'dat_nung_2', set: 'dat_nung', name: 'Chậu bát', shape: 2 },
  { id: 'dat_nung_3', set: 'dat_nung', name: 'Chậu ống cao', shape: 3 },
  { id: 'dat_nung_4', set: 'dat_nung', name: 'Chậu vuông', shape: 4 },
  { id: 'dat_nung_5', set: 'dat_nung', name: 'Chậu bầu', shape: 5 },
  { id: 'dat_nung_6', set: 'dat_nung', name: 'Chậu có đĩa', shape: 6 },
]
export const potSetById = new Map(POT_SETS.map((s) => [s.id, s]))
export const potKindById = new Map(POT_KINDS.map((k) => [k.id, k]))
export const potImage = (kind: string, level: number) => `/game/chau/${kind}_${Math.max(1, Math.min(6, level))}.webp`

// Màu hạng (kèm chữ B / A / S cho người khó phân biệt màu)
export const RANK_STYLE: Record<Rank, string> = {
  B: 'from-sky-400 to-blue-600',
  A: 'from-violet-400 to-purple-700',
  S: 'from-amber-300 to-orange-500',
}

// ---- Chậu người chơi có, chỗ đặt ----
export interface OwnedPot { id: string; kind: string; level: number }
// Chỗ đặt: `${tầng 0-3}-${chỗ}` -> id chậu
export const slotKey = (tier: number, slot: number) => `${tier}-${slot}`

// ---- Hiệu ứng của 1 bộ trên 1 tầng ----
export interface SetOnTier {
  set: PotSet
  count: number // số chậu KHÁC NHAU của bộ trên tầng
  level: number // cấp trung bình của các chậu được tính
  reached: number // số mốc đã đạt
  value: number | null // mức hiệu ứng chính hiện tại (mốc cao nhất đã đạt)
  full: boolean
  bonus: number | null
}
// `pots` = các chậu đang đặt trên tầng
export function setsOnTier(pots: OwnedPot[]): SetOnTier[] {
  const best = new Map<string, number>() // loại chậu -> cấp cao nhất
  for (const p of pots) best.set(p.kind, Math.max(best.get(p.kind) ?? 0, p.level))
  const out: SetOnTier[] = []
  for (const set of POT_SETS) {
    const lv = set.kinds.filter((k) => best.has(k)).map((k) => best.get(k)!)
    if (!lv.length) continue
    const count = lv.length
    const level = lv.reduce((a, b) => a + b, 0) / count
    const ms = set.milestones.filter((m) => m.count <= count)
    const top = ms[ms.length - 1]
    const full = count >= set.kinds.length
    out.push({ set, count, level, reached: ms.length, value: top ? valueAt(top, level) : null, full, bonus: full ? valueAt(set.bonus, level) : null })
  }
  return out
}
