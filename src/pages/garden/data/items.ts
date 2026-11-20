// Vật phẩm của game Vườn mây: phân bón (rút ngắn thời gian lớn) và mảnh vỡ sao (tiền đổi đồ đặc biệt ở cửa hàng).
// Xem CLAUDE.md "Phân bón" và "Mảnh vỡ sao sáng / Mảnh vỡ sao".

// ---- Phân bón: mỗi lần bón giảm % TỔNG thời gian lớn; mỗi cây tối đa 2 lần, tổng tối đa 60%; chỉ bón cây chưa chín ----
export type FertId = 'B' | 'A'
// img = icon dựng bằng Blender (public/game/phan/, design/vuon-may/scripts/phan_bon.py); icon = icon nét dự phòng
export const FERTS: { id: FertId; name: string; icon: string; img: string; cut: number; price: number; dailyLimit: number | null }[] = [
  { id: 'B', name: 'Phân bón B', icon: '🌱', img: '/game/phan/B.webp', cut: 0.2, price: 40, dailyLimit: null },
  { id: 'A', name: 'Phân bón A', icon: '🌿', img: '/game/phan/A.webp', cut: 0.4, price: 150, dailyLimit: 5 },
]
export const fertById = new Map(FERTS.map((f) => [f.id, f]))
export const MAX_FERT_TIMES = 2
export const MAX_FERT_CUT = 0.6
export const FERT_MIN_MINUTES = 10 // cây lớn dưới 10 phút: không cần bón (nút mờ)
export type Ferts = Record<FertId, number>
export const NO_FERTS: Ferts = { B: 0, A: 0 }

// ---- Mảnh vỡ sao ----
export type ShardId = 'sao_sang' | 'sao'
// img: public/game/sao/ (design/vuon-may/scripts/manh_sao.py)
export const SHARDS: { id: ShardId; name: string; icon: string; img: string; feathers: number }[] = [
  { id: 'sao_sang', name: 'Mảnh vỡ sao sáng', icon: '⭐', img: '/game/sao/sao_sang.webp', feathers: 15 }, // quý hơn; đổi ngược ra lông chim
  { id: 'sao', name: 'Mảnh vỡ sao', icon: '✨', img: '/game/sao/sao.webp', feathers: 4 },
]
export const shardById = new Map(SHARDS.map((s) => [s.id, s]))
export type Shards = Record<ShardId, number>
export const NO_SHARDS: Shards = { sao_sang: 0, sao: 0 }
export const STONE_TO_FEATHERS = 5 // đổi 1 đá vũ trụ = 5 lông chim (1 chiều)

// Tháng / ngày theo giờ máy (giới hạn mua / đổi)
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const dayKey = (d = new Date()) => `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`
