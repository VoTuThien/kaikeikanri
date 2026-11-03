import { addMinutes, type BabyEntry } from './types'

// Time line dạng DANH SÁCH THẺ CAO BẰNG NHAU (không theo tỉ lệ thời gian, không có cột giờ), xếp theo giờ bắt đầu.
// Các hoạt động được phép CHỒNG thời gian lên nhau (kéo thẻ đè lên thẻ khác, hoặc nhân bản):
// thẻ chồng giờ với thẻ trước thì vẽ ĐÈ lên thẻ đó, lệch xuống theo tỉ lệ (bắt đầu giữa thẻ trước = đè nửa dưới; cùng giờ bắt đầu = đè trọn).
// Phần giao nhau tô màu trộn.

export const CARD_PX = 56 // chiều cao mọi thẻ
export const GAP_PX = 8 // khoảng cách giữa 2 thẻ không chồng nhau
// Hoạt động sắp bắt đầu (chưa có giờ kết thúc) tính tạm dài 30 phút
const UPCOMING_MIN = 30
// Kéo thẻ: giờ nhảy theo bước 5 phút; kéo ra ngoài các thẻ khác (trên thẻ đầu / dưới thẻ cuối) thì 1 chiều cao thẻ = 30 phút
export const SNAP_MIN = 5
const OUTSIDE_MS_PER_PX = (30 * 60000) / CARD_PX

// Vị trí 1 thẻ trong danh sách (px); open = chưa có giờ kết thúc (vẽ đuôi nét đứt)
export interface Block {
  entry: BabyEntry
  top: number
  bottom: number
  open: boolean
}

// Giờ kết thúc dùng để tính chồng nhau: chưa hoàn thành thì đang diễn ra tính tới bây giờ, sắp bắt đầu tính tạm 30 phút
export function visualEnd(e: BabyEntry, now: Date) {
  if (e.end) return e.end
  if (e.start > now) return addMinutes(e.start, UPCOMING_MIN)
  return now > e.start ? now : addMinutes(e.start, 1)
}

// Xếp các thẻ: không chồng giờ với thẻ nào phía trên thì nằm dưới thẻ thấp nhất (cách GAP_PX);
// chồng giờ thì đè lên thẻ bắt đầu muộn nhất mà nó chồng, lệch xuống = CARD_PX × (đã qua bao nhiêu phần thời gian của thẻ đó)
export function layout(entries: BabyEntry[], now: Date): Block[] {
  const sorted = [...entries].sort((a, b) => a.start.getTime() - b.start.getTime() || visualEnd(a, now).getTime() - visualEnd(b, now).getTime())
  const blocks: Block[] = []
  let lowest = -GAP_PX
  for (const e of sorted) {
    const under = [...blocks].reverse().find((b) => visualEnd(b.entry, now) > e.start)
    let top: number
    if (under) {
      const s = under.entry.start.getTime()
      const span = Math.max(1, visualEnd(under.entry, now).getTime() - s)
      top = under.top + CARD_PX * Math.min(0.95, (e.start.getTime() - s) / span)
    } else top = lowest + GAP_PX
    top = Math.max(top, blocks.length ? blocks[blocks.length - 1].top : 0)
    blocks.push({ entry: e, top, bottom: top + CARD_PX, open: e.end === null })
    lowest = Math.max(lowest, top + CARD_PX)
  }
  return blocks
}

export const contentHeight = (blocks: Block[]) => Math.max(0, ...blocks.map((b) => b.bottom))

// Vị trí y (px) trong danh sách -> giờ, dựa vào vị trí các thẻ KHÁC (đầu thẻ = giờ bắt đầu, đáy thẻ = giờ kết thúc, nội suy ở giữa);
// trên thẻ đầu / dưới thẻ cuối thì 1 chiều cao thẻ = 30 phút. Dùng để biết thẻ đang kéo được thả vào giờ nào.
export function timeAt(others: Block[], y: number, now: Date, fallback: { y: number; time: number }): number {
  const pts = others
    .flatMap((b) => [
      { y: b.top, t: b.entry.start.getTime() },
      { y: b.bottom, t: visualEnd(b.entry, now).getTime() },
    ])
    .sort((a, b) => a.y - b.y || a.t - b.t)
  if (!pts.length) pts.push({ y: fallback.y, t: fallback.time })
  // Giờ không được lùi khi đi xuống
  for (let i = 1; i < pts.length; i++) pts[i].t = Math.max(pts[i].t, pts[i - 1].t)
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (y <= first.y) return first.t - (first.y - y) * OUTSIDE_MS_PER_PX
  if (y >= last.y) return last.t + (y - last.y) * OUTSIDE_MS_PER_PX
  const i = pts.findIndex((p) => p.y > y)
  const [a, b] = [pts[i - 1], pts[i]]
  return a.t + ((y - a.y) / (b.y - a.y)) * (b.t - a.t)
}

// Đoạn có từ 2 hoạt động trở lên chồng nhau (đã gộp các đoạn liền nhau có cùng tập hoạt động)
export interface Overlap {
  top: number
  bottom: number
  ids: string[]
}

export function overlapsOf(blocks: Block[]): Overlap[] {
  const cuts = [...new Set(blocks.flatMap((b) => [b.top, b.bottom]))].sort((a, b) => a - b)
  const out: Overlap[] = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]]
    const ids = blocks.filter((x) => x.top <= a && x.bottom >= b).map((x) => x.entry.id)
    if (ids.length < 2) continue
    const last = out[out.length - 1]
    if (last && last.bottom === a && last.ids.join() === ids.join()) last.bottom = b
    else out.push({ top: a, bottom: b, ids })
  }
  return out
}

// Các hoạt động đang có mặt tại vị trí y (px)
export const blocksAt = (blocks: Block[], y: number) => blocks.filter((b) => b.top <= y && y < b.bottom)

// Nhãn (icon + tên + giờ) nằm ở đầu mỗi thẻ, cao LABEL_PX. Nhãn của các thẻ bắt đầu gần nhau thì chia làn ngang
// (lane / lanes) để không đè chữ lên nhau.
export const LABEL_PX = 24
// Nhãn có thêm dòng thứ 2 khi thẻ đủ cao và nhãn kế tiếp bắt đầu đủ xa
// (không chia làn: trạng thái, người ghi; chia làn: giờ — vì dòng 1 hẹp không đủ chỗ cho giờ)
export const TALL_LABEL_PX = 44
export interface LabelSlot {
  lane: number
  lanes: number
  height: number
}

export function labelLanes(blocks: Block[]): Map<string, LabelSlot> {
  const sorted = [...blocks].sort((a, b) => a.top - b.top || a.entry.start.getTime() - b.entry.start.getTime())
  const slots = new Map<string, LabelSlot>()
  let cluster: { id: string; lane: number }[] = []
  let laneEnds: number[] = []
  let clusterEnd = -Infinity
  const flush = () => {
    const lanes = laneEnds.length
    for (const c of cluster) {
      const b = sorted.find((x) => x.entry.id === c.id)!
      const nextTop = sorted.find((x) => x.top > b.top)?.top ?? Infinity
      const tall = b.bottom - b.top >= TALL_LABEL_PX && nextTop - b.top >= TALL_LABEL_PX
      slots.set(c.id, { lane: c.lane, lanes, height: tall ? TALL_LABEL_PX : LABEL_PX })
    }
    cluster = []
    laneEnds = []
  }
  for (const b of sorted) {
    if (b.top >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= b.top)
    if (lane < 0) lane = laneEnds.push(0) - 1
    laneEnds[lane] = b.top + LABEL_PX
    cluster.push({ id: b.entry.id, lane })
    clusterEnd = Math.max(clusterEnd, b.top + LABEL_PX)
  }
  flush()
  return slots
}

// ---- Kéo thẻ (nhấn giữ rồi kéo) ----
// Thẻ đi theo ngón tay; thả ở đâu thì giờ bắt đầu = giờ ở vị trí đầu thẻ (timeAt), làm tròn 5 phút, trong ngày đang xem.
// Kéo lên hay xuống đều DỜI CẢ THẺ (giữ số phút; chưa có giờ kết thúc thì vẫn chưa có). Không đẩy các thẻ khác:
// thả đè lên thẻ khác thì 2 thẻ chồng thời gian; kéo ra ngoài lại thì hết chồng.
export function dragTiming(block: Block, others: Block[], dy: number, day: Date, now: Date): { start: Date; changed: boolean } {
  const e = block.entry
  const raw = timeAt(others, block.top + dy, now, { y: block.top, time: e.start.getTime() })
  const step = SNAP_MIN * 60000
  const min = day.getTime()
  const max = day.getTime() + 24 * 3600000 - step
  const start = new Date(Math.max(min, Math.min(max, Math.round(raw / step) * step)))
  // Nhích rất ít (chưa tới nửa bước) thì giữ nguyên giờ cũ
  const changed = Math.abs(start.getTime() - e.start.getTime()) >= step / 2 && Math.abs(dy) > 4
  return { start: changed ? start : e.start, changed }
}

// ---- Màu ----
// Màu thẻ lưu dạng class gradient Tailwind ("from-amber-400 to-orange-500"); để trộn màu cần mã RGB của từng màu.
const PALETTE: Record<string, string> = {
  'amber-400': '#fbbf24',
  'orange-500': '#f97316',
  'sky-400': '#38bdf8',
  'blue-600': '#2563eb',
  'emerald-400': '#34d399',
  'teal-600': '#0d9488',
  'pink-400': '#f472b6',
  'rose-600': '#e11d48',
  'violet-400': '#a78bfa',
  'purple-600': '#9333ea',
  'slate-400': '#94a3b8',
  'slate-600': '#475569',
}
const FALLBACK = '#94a3b8'

type Rgb = [number, number, number]
const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb
const toCss = ([r, g, b]: Rgb) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`

// 2 điểm màu của gradient (from, to)
export function colorStops(color: string): [Rgb, Rgb] {
  const pick = (prefix: string) => PALETTE[color.match(new RegExp(`${prefix}-([a-z]+-\\d+)`))?.[1] ?? ''] ?? FALLBACK
  return [toRgb(pick('from')), toRgb(pick('to'))]
}

// Trộn màu kiểu pha màu vẽ (trừ màu / nhân màu): vàng + xanh dương ra xanh lá, 2 màu giống nhau thì ĐẬM hơn
const multiply = (colors: Rgb[]): Rgb => colors.reduce<Rgb>((acc, c) => [(acc[0] * c[0]) / 255, (acc[1] * c[1]) / 255, (acc[2] * c[2]) / 255], [255, 255, 255])

export const blockBackground = (color: string) => {
  const [from, to] = colorStops(color)
  return `linear-gradient(135deg, ${toCss(from)}, ${toCss(to)})`
}

export function mixedBackground(colors: string[]) {
  const stops = colors.map(colorStops)
  return `linear-gradient(135deg, ${toCss(multiply(stops.map((s) => s[0])))}, ${toCss(multiply(stops.map((s) => s[1])))})`
}
