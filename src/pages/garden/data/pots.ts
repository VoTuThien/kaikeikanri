// Bộ chậu của game Vườn mây (xem CLAUDE.md "Bộ chậu"): mỗi bộ ≤ 6 chậu khác nhau chung 1 chủ đề, hạng B / A / S cố định theo bộ,
// mỗi chậu có cấp 1–6. Hiệu ứng chỉ áp dụng cho TẦNG đặt bộ chậu, theo số chậu KHÁC NHAU của bộ trên tầng (mốc riêng từng bộ) + cấp trung bình.
// GĐ3 mới hiển thị hiệu ứng (bảng thông tin khi đặt chậu); áp dụng vào luật chơi ở GĐ5.

export type Rank = 'B' | 'A' | 'S'
export type EffectId = 'seed' | 'xp' | 'price' | 'bug' | 'moist' | 'grow' | 'yield' | 'insect' | 'luck' | 'machine' | 'growyield'

export const EFFECTS: Record<EffectId, { name: string; fmt: (v: number) => string }> = {
  seed: { name: 'Hạt rẻ', fmt: (v) => `−${pct(v)}` },
  xp: { name: 'Thêm kinh nghiệm', fmt: (v) => `+${pct(v)}` },
  price: { name: 'Giá tốt', fmt: (v) => `+${pct(v)}` },
  bug: { name: 'Ít sâu', fmt: (v) => `−${pct(v)}` },
  moist: { name: 'Giữ ẩm', fmt: (v) => `${pct(v)}` }, // cơ hội cây tự tính là đã tưới
  grow: { name: 'Lớn nhanh', fmt: (v) => `−${pct(v)}` }, // giảm thời gian chín
  yield: { name: 'Bội thu', fmt: (v) => `+${pct(v)}` }, // thêm nông sản (phần lẻ = cơ hội được thêm 1)
  insect: { name: 'Hút côn trùng', fmt: (v) => `+${pct(v)}` }, // gặp bọ rùa / đom đóm / nhện / sâu nhiều hơn
  // hạng S
  luck: { name: 'Mùa may', fmt: (v) => `${pct(v)}` }, // cơ hội thu hoạch gấp đôi
  machine: { name: 'Máy chạy nhanh', fmt: (v) => `−${pct(v)}` }, // máy chế tạo cùng tầng làm nhanh hơn
  growyield: { name: 'Lớn nhanh + Bội thu', fmt: (v) => `${pct(v)}` },
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
  file: string // file mô hình của bộ (`public/models/…`), mỗi chậu là 1 node gốc `PotKind.model`
  effect: EffectId // hiệu ứng chính
  milestones: (Level & { count: number })[] // mốc theo số chậu khác nhau trên tầng
  bonus: Level & { effect: EffectId } // thưởng đủ bộ
  tiers?: number[] // chỉ đặt được ở các tầng này (0-3); bỏ trống = tầng nào cũng được
  perk?: string // hạng S: đặc quyền riêng khi đủ bộ trên tầng
}
// Bộ chậu chỉ dành cho 1 số tầng: đặt ở tầng khác thì trả về lý do
export function tierBlock(set: PotSet, tier: number): string | null {
  if (!set.tiers || set.tiers.includes(tier)) return null
  return `Chỉ đặt ở tầng ${set.tiers.map((t) => t + 1).join(', ')}`
}
export interface PotKind {
  id: string
  set: string
  name: string
  model: string // tên node gốc trong file mô hình của bộ (con: `<model>_Than` / `_Dat` / `_DiemCay` / `_Lv2…Lv6`)
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
    file: '/models/chau-dat-nung.glb',
  },
  {
    id: 'may_tre',
    name: 'Mây tre',
    rank: 'B',
    kinds: ['may_tre_1', 'may_tre_2', 'may_tre_3', 'may_tre_4', 'may_tre_5', 'may_tre_6'],
    effect: 'price',
    milestones: [
      { count: 2, lv1: 2, lv6: 4 },
      { count: 4, lv1: 3, lv6: 8 },
      { count: 6, lv1: 5, lv6: 12 },
    ],
    bonus: { effect: 'bug', lv1: 2, lv6: 5 },
    file: '/models/chau-may-tre.glb',
  },
  {
    id: 'bien_ca',
    name: 'Biển cả',
    rank: 'A',
    kinds: ['bien_ca_1', 'bien_ca_2', 'bien_ca_3', 'bien_ca_4', 'bien_ca_5', 'bien_ca_6'],
    effect: 'moist',
    milestones: [
      { count: 2, lv1: 4, lv6: 10 },
      { count: 4, lv1: 8, lv6: 20 },
      { count: 6, lv1: 12, lv6: 30 },
    ],
    bonus: { effect: 'xp', lv1: 4, lv6: 10 },
    file: '/models/chau-bien-ca.glb',
  },
  {
    id: 'rung_nam',
    name: 'Rừng nấm',
    rank: 'A',
    kinds: ['rung_nam_1', 'rung_nam_2', 'rung_nam_3', 'rung_nam_4', 'rung_nam_5', 'rung_nam_6'],
    effect: 'grow',
    milestones: [
      { count: 2, lv1: 4, lv6: 10 },
      { count: 4, lv1: 8, lv6: 20 },
      { count: 6, lv1: 12, lv6: 30 },
    ],
    bonus: { effect: 'seed', lv1: 4, lv6: 10 },
    file: '/models/chau-rung-nam.glb',
  },
  {
    id: 'trung_thu',
    name: 'Trung thu',
    rank: 'A',
    kinds: ['trung_thu_1', 'trung_thu_2', 'trung_thu_3', 'trung_thu_4', 'trung_thu_5', 'trung_thu_6'],
    effect: 'yield',
    milestones: [
      { count: 2, lv1: 4, lv6: 10 },
      { count: 4, lv1: 8, lv6: 20 },
      { count: 6, lv1: 12, lv6: 30 },
    ],
    bonus: { effect: 'price', lv1: 4, lv6: 10 },
    file: '/models/chau-trung-thu.glb',
  },
  {
    id: 'mat_ong',
    name: 'Mật ong',
    rank: 'A',
    kinds: ['mat_ong_1', 'mat_ong_2', 'mat_ong_3', 'mat_ong_4', 'mat_ong_5', 'mat_ong_6'],
    effect: 'insect',
    milestones: [
      { count: 2, lv1: 4, lv6: 10 },
      { count: 4, lv1: 8, lv6: 20 },
      { count: 6, lv1: 12, lv6: 30 },
    ],
    bonus: { effect: 'bug', lv1: 4, lv6: 10 },
    file: '/models/chau-mat-ong.glb',
  },
  {
    // bộ 4 chậu, chỉ đặt ở tầng 4 (tầng 4 có đúng 4 chỗ) → mốc 2 / 3 / 4 chậu khác nhau
    id: 'thien_ha',
    name: 'Thiên hà',
    rank: 'A',
    kinds: ['thien_ha_1', 'thien_ha_2', 'thien_ha_3', 'thien_ha_4'],
    effect: 'grow',
    milestones: [
      { count: 2, lv1: 4, lv6: 10 },
      { count: 3, lv1: 8, lv6: 20 },
      { count: 4, lv1: 12, lv6: 30 },
    ],
    bonus: { effect: 'xp', lv1: 4, lv6: 10 },
    file: '/models/chau-thien-ha.glb',
    tiers: [3],
  },
  {
    // hạng S "lệch rate" 1: rơi khi ra vàng ngoài banner
    id: 'su_lam',
    name: 'Sứ Lam',
    rank: 'S',
    kinds: ['su_lam_1', 'su_lam_2', 'su_lam_3', 'su_lam_4', 'su_lam_5', 'su_lam_6'],
    effect: 'luck',
    milestones: [
      { count: 2, lv1: 6, lv6: 15 },
      { count: 4, lv1: 12, lv6: 30 },
      { count: 6, lv1: 18, lv6: 45 },
    ],
    bonus: { effect: 'yield', lv1: 6, lv6: 15 },
    perk: 'Cây chín tự vào kho',
    file: '/models/chau-su-lam.glb',
  },
  {
    // hạng S "lệch rate" 2
    id: 'bang_tinh',
    name: 'Băng Tinh',
    rank: 'S',
    kinds: ['bang_tinh_1', 'bang_tinh_2', 'bang_tinh_3', 'bang_tinh_4', 'bang_tinh_5', 'bang_tinh_6'],
    effect: 'machine',
    milestones: [
      { count: 2, lv1: 6, lv6: 15 },
      { count: 4, lv1: 12, lv6: 30 },
      { count: 6, lv1: 18, lv6: 45 },
    ],
    bonus: { effect: 'grow', lv1: 6, lv6: 15 },
    perk: 'Tầng không bao giờ bị sâu',
    file: '/models/chau-bang-tinh.glb',
  },
  {
    // hạng S, bộ banner chậu 1
    id: 'phuong_hoang',
    name: 'Phượng Hoàng',
    rank: 'S',
    kinds: ['phuong_hoang_1', 'phuong_hoang_2', 'phuong_hoang_3', 'phuong_hoang_4', 'phuong_hoang_5', 'phuong_hoang_6'],
    effect: 'growyield',
    milestones: [
      { count: 2, lv1: 6, lv6: 15 },
      { count: 4, lv1: 12, lv6: 30 },
      { count: 6, lv1: 18, lv6: 45 },
    ],
    bonus: { effect: 'moist', lv1: 6, lv6: 15 },
    perk: 'Côn trùng tự vào lưới',
    file: '/models/chau-phuong-hoang.glb',
  },
]
export const POT_KINDS: PotKind[] = [
  { id: 'dat_nung_1', set: 'dat_nung', name: 'Chậu tròn', model: 'ChauDat_1' },
  { id: 'dat_nung_2', set: 'dat_nung', name: 'Chậu bát', model: 'ChauDat_2' },
  { id: 'dat_nung_3', set: 'dat_nung', name: 'Chậu ống cao', model: 'ChauDat_3' },
  { id: 'dat_nung_4', set: 'dat_nung', name: 'Chậu vuông', model: 'ChauDat_4' },
  { id: 'dat_nung_5', set: 'dat_nung', name: 'Chậu bầu', model: 'ChauDat_5' },
  { id: 'dat_nung_6', set: 'dat_nung', name: 'Chậu có đĩa', model: 'ChauDat_6' },
  { id: 'may_tre_1', set: 'may_tre', name: 'Giỏ đan tròn', model: 'ChauTre_1' },
  { id: 'may_tre_2', set: 'may_tre', name: 'Ống tre', model: 'ChauTre_2' },
  { id: 'may_tre_3', set: 'may_tre', name: 'Thúng mây', model: 'ChauTre_3' },
  { id: 'may_tre_4', set: 'may_tre', name: 'Gùi tre', model: 'ChauTre_4' },
  { id: 'may_tre_5', set: 'may_tre', name: 'Bình mây', model: 'ChauTre_5' },
  { id: 'may_tre_6', set: 'may_tre', name: 'Giỏ chân tre', model: 'ChauTre_6' },
  { id: 'bien_ca_1', set: 'bien_ca', name: 'Vỏ sò', model: 'ChauBien_1' },
  { id: 'bien_ca_2', set: 'bien_ca', name: 'Ốc xoắn', model: 'ChauBien_2' },
  { id: 'bien_ca_3', set: 'bien_ca', name: 'Chậu san hô', model: 'ChauBien_3' },
  { id: 'bien_ca_4', set: 'bien_ca', name: 'Sóng biển', model: 'ChauBien_4' },
  { id: 'bien_ca_5', set: 'bien_ca', name: 'Thùng gỗ đắm', model: 'ChauBien_5' },
  { id: 'bien_ca_6', set: 'bien_ca', name: 'Hũ xà cừ', model: 'ChauBien_6' },
  { id: 'rung_nam_1', set: 'rung_nam', name: 'Nấm mũ đỏ', model: 'ChauNam_1' },
  { id: 'rung_nam_2', set: 'rung_nam', name: 'Gốc cây', model: 'ChauNam_2' },
  { id: 'rung_nam_3', set: 'rung_nam', name: 'Chậu đá rêu', model: 'ChauNam_3' },
  { id: 'rung_nam_4', set: 'rung_nam', name: 'Nhà nấm', model: 'ChauNam_4' },
  { id: 'rung_nam_5', set: 'rung_nam', name: 'Chậu lá', model: 'ChauNam_5' },
  { id: 'rung_nam_6', set: 'rung_nam', name: 'Chậu nấm chùm', model: 'ChauNam_6' },
  { id: 'trung_thu_1', set: 'trung_thu', name: 'Bánh trung thu', model: 'ChauTT_1' },
  { id: 'trung_thu_2', set: 'trung_thu', name: 'Đèn lồng', model: 'ChauTT_2' },
  { id: 'trung_thu_3', set: 'trung_thu', name: 'Mặt trăng', model: 'ChauTT_3' },
  { id: 'trung_thu_4', set: 'trung_thu', name: 'Ông sao', model: 'ChauTT_4' },
  { id: 'trung_thu_5', set: 'trung_thu', name: 'Thỏ ngọc', model: 'ChauTT_5' },
  { id: 'trung_thu_6', set: 'trung_thu', name: 'Trống lân', model: 'ChauTT_6' },
  { id: 'mat_ong_1', set: 'mat_ong', name: 'Tổ ong rơm', model: 'ChauMO_1' },
  { id: 'mat_ong_2', set: 'mat_ong', name: 'Hũ mật ong', model: 'ChauMO_2' },
  { id: 'mat_ong_3', set: 'mat_ong', name: 'Chậu tổ ong', model: 'ChauMO_3' },
  { id: 'mat_ong_4', set: 'mat_ong', name: 'Hoa cúc', model: 'ChauMO_4' },
  { id: 'mat_ong_5', set: 'mat_ong', name: 'Cánh bướm', model: 'ChauMO_5' },
  { id: 'mat_ong_6', set: 'mat_ong', name: 'Chú ong', model: 'ChauMO_6' },
  { id: 'thien_ha_1', set: 'thien_ha', name: 'Trăng khuyết', model: 'ChauTH_1' },
  { id: 'thien_ha_2', set: 'thien_ha', name: 'Hành tinh', model: 'ChauTH_2' },
  { id: 'thien_ha_3', set: 'thien_ha', name: 'Ngôi sao', model: 'ChauTH_3' },
  { id: 'thien_ha_4', set: 'thien_ha', name: 'Tinh vân', model: 'ChauTH_4' },
  { id: 'su_lam_1', set: 'su_lam', name: 'Bình hoa lam', model: 'ChauSL_1' },
  { id: 'su_lam_2', set: 'su_lam', name: 'Bát sen', model: 'ChauSL_2' },
  { id: 'su_lam_3', set: 'su_lam', name: 'Chóe tai lân', model: 'ChauSL_3' },
  { id: 'su_lam_4', set: 'su_lam', name: 'Đôn sứ', model: 'ChauSL_4' },
  { id: 'su_lam_5', set: 'su_lam', name: 'Chậu bát giác', model: 'ChauSL_5' },
  { id: 'su_lam_6', set: 'su_lam', name: 'Chậu chân quỳ', model: 'ChauSL_6' },
  { id: 'bang_tinh_1', set: 'bang_tinh', name: 'Bình băng', model: 'ChauBT_1' },
  { id: 'bang_tinh_2', set: 'bang_tinh', name: 'Bát tuyết', model: 'ChauBT_2' },
  { id: 'bang_tinh_3', set: 'bang_tinh', name: 'Chậu tinh thể', model: 'ChauBT_3' },
  { id: 'bang_tinh_4', set: 'bang_tinh', name: 'Chậu bông tuyết', model: 'ChauBT_4' },
  { id: 'bang_tinh_5', set: 'bang_tinh', name: 'Chậu băng xoắn', model: 'ChauBT_5' },
  { id: 'bang_tinh_6', set: 'bang_tinh', name: 'Chậu chân băng', model: 'ChauBT_6' },
  { id: 'phuong_hoang_1', set: 'phuong_hoang', name: 'Bình lông vũ', model: 'ChauPH_1' },
  { id: 'phuong_hoang_2', set: 'phuong_hoang', name: 'Bát cánh phượng', model: 'ChauPH_2' },
  { id: 'phuong_hoang_3', set: 'phuong_hoang', name: 'Chậu tổ lửa', model: 'ChauPH_3' },
  { id: 'phuong_hoang_4', set: 'phuong_hoang', name: 'Chậu đuôi phượng', model: 'ChauPH_4' },
  { id: 'phuong_hoang_5', set: 'phuong_hoang', name: 'Chậu mặt trời', model: 'ChauPH_5' },
  { id: 'phuong_hoang_6', set: 'phuong_hoang', name: 'Tháp lửa', model: 'ChauPH_6' },
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

// Bộ tặng sẵn khi bắt đầu (6 chậu cấp 1, id cố định `g_<loại>` để đọc nhiều lần vẫn ra cùng id). Các bộ khác lấy qua gacha.
// (Trước khi có gacha mọi người được tặng đủ 10 bộ để thử; vườn đã lưu các chậu đó thì vẫn giữ.)
export const STARTER_SETS = ['dat_nung']

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
