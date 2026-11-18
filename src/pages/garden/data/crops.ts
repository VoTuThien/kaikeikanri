// Luật chơi của game Vườn mây (tính hoàn toàn ở máy, không cần server).
// Cây lớn theo THỜI GIAN THẬT tính từ lúc gieo (`plantedAt`), nên đóng app cây vẫn lớn.

export interface Crop {
  id: string
  name: string
  icon: string // emoji tra sang icon nét (Glyph.tsx)
  level: number // cấp mở khoá
  seedPrice: number // xu mua hạt (gieo là trừ luôn)
  sellPrice: number // xu bán 1 nông sản
  yield: number // số nông sản thu được (chưa tính tưới / sâu)
  minutes: number // thời gian lớn
  xp: number // kinh nghiệm mỗi lần thu hoạch
  color: string // màu nền ô khi chín (class Tailwind)
}

export const CROPS: Crop[] = [
  { id: 'cai', name: 'Rau cải', icon: '🥬', level: 1, seedPrice: 5, sellPrice: 4, yield: 3, minutes: 3, xp: 2, color: 'from-lime-400/70 to-green-600/70' },
  { id: 'carot', name: 'Cà rốt', icon: '🥕', level: 1, seedPrice: 10, sellPrice: 7, yield: 3, minutes: 10, xp: 4, color: 'from-orange-400/70 to-amber-600/70' },
  { id: 'cachua', name: 'Cà chua', icon: '🍅', level: 2, seedPrice: 20, sellPrice: 12, yield: 3, minutes: 30, xp: 8, color: 'from-rose-400/70 to-red-600/70' },
  { id: 'ngo', name: 'Ngô', icon: '🌽', level: 3, seedPrice: 30, sellPrice: 18, yield: 3, minutes: 60, xp: 12, color: 'from-yellow-300/70 to-amber-500/70' },
  { id: 'dau', name: 'Dâu tây', icon: '🍓', level: 4, seedPrice: 45, sellPrice: 22, yield: 4, minutes: 120, xp: 20, color: 'from-pink-400/70 to-rose-600/70' },
  { id: 'huongduong', name: 'Hướng dương', icon: '🌻', level: 5, seedPrice: 60, sellPrice: 35, yield: 3, minutes: 240, xp: 30, color: 'from-yellow-400/70 to-orange-500/70' },
  { id: 'duahau', name: 'Dưa hấu', icon: '🍉', level: 6, seedPrice: 90, sellPrice: 70, yield: 2, minutes: 480, xp: 50, color: 'from-emerald-400/70 to-green-700/70' },
  { id: 'bingo', name: 'Bí ngô', icon: '🎃', level: 8, seedPrice: 150, sellPrice: 110, yield: 2, minutes: 720, xp: 80, color: 'from-orange-500/70 to-amber-700/70' },
]

export const cropById = new Map(CROPS.map((c) => [c.id, c]))

// ---- Ô đất ----
export const MAX_PLOTS = 12 // lưới 4 cột × 3 hàng
export const START_PLOTS = 6
export const START_COINS = 100

// Giá mở ô thứ `index` (0-based, ô đầu tiên còn khoá là START_PLOTS): 100, 200, 400…
export const plotPrice = (index: number) => 100 * 2 ** (index - START_PLOTS)

export interface Plot {
  crop: string | null // id cây đang trồng, null = đất trống
  plantedAt: number // lúc gieo (ms)
  watered: boolean // đã tưới: +1 nông sản
  bugCleared: boolean // đã bắt sâu
}

export const EMPTY_PLOT: Plot = { crop: null, plantedAt: 0, watered: false, bugCleared: false }

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

export interface PlotState {
  crop: ReturnType<typeof cropById.get>
  progress: number // 0..1
  stage: Stage
  ripe: boolean
  leftMs: number // còn bao lâu nữa thì chín
  hasBug: boolean // đang có sâu (chưa bắt)
  thirsty: boolean // chưa tưới (còn tưới được)
  harvest: number // số nông sản sẽ thu được nếu thu hoạch bây giờ (chỉ có nghĩa khi chín)
}

// Cây có bị sâu không: cố định theo lúc gieo (khoảng 1/3 số lần gieo), sâu xuất hiện khi cây lớn được nửa chừng
const bugged = (plantedAt: number) => Math.floor(plantedAt / 1000) % 3 === 0

export function plotState(plot: Plot, now: number): PlotState | null {
  const crop = plot.crop ? cropById.get(plot.crop) : undefined
  if (!crop) return null
  const total = crop.minutes * 60_000
  const progress = Math.min(1, Math.max(0, (now - plot.plantedAt) / total))
  const ripe = progress >= 1
  const stage: Stage = ripe ? 3 : progress >= 0.6 ? 2 : progress >= 0.2 ? 1 : 0
  const hasBug = bugged(plot.plantedAt) && progress >= 0.5 && !plot.bugCleared
  const harvest = Math.max(1, crop.yield + (plot.watered ? 1 : 0) - (hasBug ? 1 : 0))
  return { crop, progress, stage, ripe, leftMs: Math.max(0, plot.plantedAt + total - now), hasBug, thirsty: !plot.watered && !ripe, harvest }
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
