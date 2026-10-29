import { addMinutes, startOfDay, type BabyEntry } from './types'

// Tổng thời gian của 1 hoạt động (thẻ) trong ngày
export interface ActivityStat {
  key: string // cardId (thẻ đã xoá thì vẫn gom theo id cũ)
  name: string
  icon: string
  color: string
  minutes: number
  count: number
  ongoing: boolean // có lần đang diễn ra (số phút tính tới hiện tại)
}

// Số phút được tính của 1 lần hoạt động:
// - đã hoàn thành: số phút đã ghi
// - đang diễn ra: từ lúc bắt đầu tới bây giờ (ngày đã qua thì tới hết ngày)
// - sắp bắt đầu: chưa tính
function countedMinutes(e: BabyEntry, now: Date): number {
  if (e.end) return e.minutes ?? Math.max(0, Math.round((e.end.getTime() - e.start.getTime()) / 60000))
  if (e.start > now) return 0
  const dayEnd = addMinutes(startOfDay(e.start), 24 * 60)
  const until = now < dayEnd ? now : dayEnd
  return Math.max(0, Math.floor((until.getTime() - e.start.getTime()) / 60000))
}

// Gom các lần hoạt động trong ngày theo thẻ, xếp theo thời gian giảm dần.
// Mỗi lần được tính trọn cho ngày nó bắt đầu (kể cả khi kéo qua nửa đêm).
export function dayStats(entries: BabyEntry[], now = new Date()): ActivityStat[] {
  const map = new Map<string, ActivityStat>()
  for (const e of entries) {
    if (e.start > now && !e.end) continue
    const key = e.cardId || e.name
    const s = map.get(key) ?? { key, name: e.name, icon: e.icon, color: e.color, minutes: 0, count: 0, ongoing: false }
    s.minutes += countedMinutes(e, now)
    s.count += 1
    s.ongoing ||= !e.end
    map.set(key, s)
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
}

// Trục dọc: bước tròn (5, 10, 15, 30 phút, 1, 2, 3, 4, 6 giờ) sao cho có tối đa 4 khoảng
const STEPS = [5, 10, 15, 30, 60, 120, 180, 240, 360]
export function niceScale(max: number): { top: number; ticks: number[] } {
  const step = STEPS.find((s) => Math.ceil(max / s) <= 4) ?? 480
  const top = Math.max(step, Math.ceil(max / step) * step)
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) }
}

// Dạng ngắn cho nhãn trên cột / trục: 45 -> "45p", 120 -> "2g", 150 -> "2g30"
export function compactDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!minutes) return '0'
  if (!h) return `${m}p`
  return m ? `${h}g${String(m).padStart(2, '0')}` : `${h}g`
}
