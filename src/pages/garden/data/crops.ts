// Luật chơi của game Vườn mây (tính hoàn toàn ở máy, không cần server).
// Cây lớn theo THỜI GIAN THẬT tính từ lúc gieo (`plantedAt`), nên đóng app cây vẫn lớn.
import type { Rank } from './pots'

export interface Crop {
  id: string
  name: string
  icon: string // emoji tra sang icon nét (Glyph.tsx)
  level: number // cấp mở khoá
  seedPrice: number // lông chim / 1 hạt ở cửa hàng (chỉ hạt hạng B)
  sellPrice: number // lông chim khi bán 1 nông sản
  yield: number // số nông sản thu được (chưa tính tưới / sâu)
  minutes: number // thời gian lớn
  xp: number // kinh nghiệm mỗi lần thu hoạch
  color: string // màu nền ô khi chín (class Tailwind)
  rank: Rank // hạng hạt giống: B (xanh biển) / A (tím) / S (vàng); chỉ hạt B bán ở cửa hàng
  bag: string // màu túi hạt 3D (hex)
}

export const CROPS: Crop[] = [
  { id: 'cai', name: 'Rau cải', icon: '🥬', level: 1, seedPrice: 5, sellPrice: 4, yield: 3, minutes: 3, xp: 2, color: 'from-lime-400/70 to-green-600/70', rank: 'B', bag: '#a3e635' },
  { id: 'carot', name: 'Cà rốt', icon: '🥕', level: 1, seedPrice: 10, sellPrice: 7, yield: 3, minutes: 10, xp: 4, color: 'from-orange-400/70 to-amber-600/70', rank: 'B', bag: '#fb923c' },
  { id: 'cachua', name: 'Cà chua', icon: '🍅', level: 2, seedPrice: 20, sellPrice: 12, yield: 3, minutes: 30, xp: 8, color: 'from-rose-400/70 to-red-600/70', rank: 'B', bag: '#fb7185' },
  { id: 'ngo', name: 'Ngô', icon: '🌽', level: 3, seedPrice: 30, sellPrice: 18, yield: 3, minutes: 60, xp: 12, color: 'from-yellow-300/70 to-amber-500/70', rank: 'B', bag: '#fde047' },
  { id: 'dau', name: 'Dâu tây', icon: '🍓', level: 4, seedPrice: 45, sellPrice: 22, yield: 4, minutes: 120, xp: 20, color: 'from-pink-400/70 to-rose-600/70', rank: 'B', bag: '#f472b6' },
  { id: 'huongduong', name: 'Hướng dương', icon: '🌻', level: 5, seedPrice: 60, sellPrice: 35, yield: 3, minutes: 240, xp: 30, color: 'from-yellow-400/70 to-orange-500/70', rank: 'B', bag: '#facc15' },
  { id: 'duahau', name: 'Dưa hấu', icon: '🍉', level: 6, seedPrice: 90, sellPrice: 70, yield: 2, minutes: 480, xp: 50, color: 'from-emerald-400/70 to-green-700/70', rank: 'B', bag: '#34d399' },
  { id: 'bingo', name: 'Bí ngô', icon: '🎃', level: 8, seedPrice: 150, sellPrice: 110, yield: 2, minutes: 720, xp: 80, color: 'from-orange-500/70 to-amber-700/70', rank: 'B', bag: '#f97316' },
]

export const cropById = new Map(CROPS.map((c) => [c.id, c]))

// Hạng hạt giống (giữ bảng độ hiếm đã duyệt): Thường = B; Hiếm = A; Rất hiếm + Cực hiếm = S.
// 8 cây hiện có đều là B. Trong suất "10 hạt giống" của gacha: B 70%, A 25%, S 5% (hạng chưa có cây thì chia lại cho hạng khác).
export const SEED_RANK_RATE: Record<Rank, number> = { B: 0.7, A: 0.25, S: 0.05 }
export const seedImage = (id: string) => `/game/tui/${id}.webp` // ảnh túi hạt (danh sách)
export const cropImage = (id: string) => `/game/cay/${id}.webp` // icon cây chín (nhãn túi, kho, cẩm nang)

// ---- Cây trồng trong chậu: lưu theo chỗ đặt chậu `"<tầng>-<chỗ>"` (garden.plants) ----
export const START_COINS = 100
export const START_FEATHERS = 100 // vốn lông chim ban đầu
export interface Plant {
  crop: string // id cây
  plantedAt: number // lúc gieo (ms)
  watered: boolean // đã tưới: +1 nông sản
  caught: boolean // đã bắt côn trùng xuất hiện trên cây
}

// ---- Cấp độ: lên cấp L cần tổng 25·L·(L−1) kinh nghiệm (cấp 2: 50, cấp 3: 150, cấp 4: 300…) ----
export const xpForLevel = (level: number) => 25 * level * (level - 1)
export function levelOf(xp: number) {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  return level
}
// Tiến độ trong cấp hiện tại: { have, need } để vẽ thanh kinh nghiệm
export function levelProgress(xp: number) {
  const level = levelOf(xp)
  const from = xpForLevel(level)
  return { level, have: xp - from, need: xpForLevel(level + 1) - from }
}

// ---- Trạng thái của cây theo thời gian ----
// Giai đoạn: 0 hạt mới gieo, 1 nảy mầm, 2 đang lớn, 3 chín
export type Stage = 0 | 1 | 2 | 3

// Côn trùng bay / bò quanh cây (có mô hình 3D), chạm để bắt → vào túi côn trùng (nâng cấp chậu ở GĐ5).
// Không làm giảm nông sản. Cố định theo lúc gieo: khoảng 1/2 số cây có 1 con (5 loại chia đều), xuất hiện khi cây lớn được 35%.
export const PLANT_INSECTS = ['sau', 'bo_rua', 'dom_dom', 'nhen', 'buom'] as const
const INSECT_AT = 0.35
function insectOf(plantedAt: number): string | null {
  const h = Math.imul(Math.floor(plantedAt / 1000) | 0, 2654435761) >>> 0
  return h % 2 === 0 ? PLANT_INSECTS[(h >>> 8) % PLANT_INSECTS.length] : null
}

export interface PlantState {
  crop: ReturnType<typeof cropById.get>
  progress: number // 0..1
  stage: Stage
  ripe: boolean
  leftMs: number // còn bao lâu nữa thì chín
  insect: string | null // côn trùng đang ở trên cây (chưa bắt)
  thirsty: boolean // chưa tưới (còn tưới được)
  harvest: number // số nông sản sẽ thu được nếu thu hoạch bây giờ (chỉ có nghĩa khi chín)
}

export function plantState(plant: Plant | null | undefined, now: number): PlantState | null {
  const crop = plant?.crop ? cropById.get(plant.crop) : undefined
  if (!plant || !crop) return null
  const total = crop.minutes * 60_000
  const progress = Math.min(1, Math.max(0, (now - plant.plantedAt) / total))
  const ripe = progress >= 1
  const stage: Stage = ripe ? 3 : progress >= 0.6 ? 2 : progress >= 0.2 ? 1 : 0
  const bug = insectOf(plant.plantedAt)
  const insect = bug && progress >= INSECT_AT && !plant.caught ? bug : null
  const harvest = crop.yield + (plant.watered ? 1 : 0)
  return { crop, progress, stage, ripe, leftMs: Math.max(0, plant.plantedAt + total - now), insect, thirsty: !plant.watered && !ripe, harvest }
}

// "2 giờ 05 phút", "12 phút", "40 giây"
export function formatLeft(ms: number) {
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s} giây`
  const m = Math.ceil(s / 60)
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} giờ ${String(rest).padStart(2, '0')}` : `${h} giờ`
}

// Thời gian lớn ghi gọn: "3 phút", "2 giờ"
export const formatGrow = (minutes: number) => (minutes < 60 ? `${minutes} phút` : `${minutes / 60} giờ`)

// Số xu: 1.250
export const formatCoins = (n: number) => n.toLocaleString('vi-VN')
