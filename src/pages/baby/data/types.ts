// Icon cho thẻ hoạt động; 4 icon đầu là các hoạt động bắt buộc phải có: ăn, ngủ, chơi, đi vệ sinh
export const CARD_ICONS: { emoji: string; label: string }[] = [
  { emoji: '🍼', label: 'Ăn' },
  { emoji: '😴', label: 'Ngủ' },
  { emoji: '🧸', label: 'Chơi' },
  { emoji: '🚽', label: 'Đi vệ sinh' },
  { emoji: '🥣', label: 'Ăn dặm' },
  { emoji: '🛁', label: 'Tắm' },
  { emoji: '🧷', label: 'Thay tã' },
  { emoji: '💊', label: 'Uống thuốc' },
  { emoji: '🌳', label: 'Đi dạo' },
  { emoji: '📚', label: 'Đọc sách' },
  { emoji: '🎵', label: 'Nghe nhạc' },
  { emoji: '🩺', label: 'Khám bệnh' },
]

export const CARD_COLORS = [
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-pink-400 to-rose-600',
  'from-violet-400 to-purple-600',
  'from-slate-400 to-slate-600',
]

// Thời gian hoạt động tối đa (phút) cho 1 lần: 24 giờ
export const MAX_MINUTES = 24 * 60

export interface BabyCard {
  id: string
  name: string
  icon: string
  color: string
  defaultMinutes: number // thời gian mặc định khi thực hiện hoạt động
  createdAt: Date | null
}

export interface BabyCardInput {
  name: string
  icon: string
  color: string
  defaultMinutes: number
}

// 1 hoạt động trên time line. Lưu kèm tên / icon / màu của thẻ lúc tạo,
// để sửa hoặc xoá thẻ sau này không làm mất lịch sử.
// Chưa hoàn thành (đang diễn ra / sắp bắt đầu) thì minutes và end là null.
export interface BabyEntry {
  id: string
  cardId: string
  name: string
  icon: string
  color: string
  start: Date
  minutes: number | null
  end: Date | null // = start + minutes
  createdByName: string
  childId: string | null // hoạt động của con nào; dữ liệu cũ (trước khi có màn hình Con) = null, tính là của con đầu tiên
}

// ---- Con (mỗi gia đình nhiều con; time line / thống kê đi theo từng con) ----
export type Gender = 'male' | 'female'

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Bé trai' },
  { value: 'female', label: 'Bé gái' },
]

// Avatar của con: ảnh thật (photo) hoặc 1 icon 3D; màu nền icon theo giới tính.
// 11 icon + 1 ô chọn ảnh = 12 ô, vừa 2 hàng của lưới 6 cột
export const CHILD_AVATARS = ['👶', '🧒', '👦', '👧', '🐣', '🐻', '🐰', '🐱', '🦊', '🐼', '🐸']
export const GENDER_COLORS: Record<Gender, string> = {
  male: 'from-sky-400 to-blue-600',
  female: 'from-pink-400 to-rose-600',
}

export interface ChildInput {
  name: string
  birthDate: string // "YYYY-MM-DD"
  birthTime: string | null // "HH:MM", không bắt buộc
  gender: Gender
  avatar: string // emoji (vẫn dùng ở ô chọn con dạng sổ xuống, nơi không hiện được ảnh)
  photo: string | null // ảnh thật: data URL JPEG đã cắt vuông + thu nhỏ trên máy (src/lib/image.ts); null = dùng icon
}

export interface Child extends ChildInput {
  id: string
  createdAt: Date | null
}

// Tuổi hiển thị: "3 tháng 12 ngày", "2 tuổi 5 tháng", "Sắp chào đời"
export function childAge(birthDate: string, now = new Date()) {
  const [y, m, d] = birthDate.split('-').map(Number)
  if (!y) return ''
  const birth = new Date(y, m - 1, d)
  if (birth > now) return 'Sắp chào đời'
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1))
  if (now.getDate() < d) months--
  if (months >= 24) return `${Math.floor(months / 12)} tuổi${months % 12 ? ` ${months % 12} tháng` : ''}`
  const anchor = new Date(y, m - 1 + months, d)
  const days = Math.floor((now.getTime() - anchor.getTime()) / 86400000)
  if (months === 0) return `${days + 1} ngày tuổi`
  return `${months} tháng${days ? ` ${days} ngày` : ''}`
}

export interface BabyEntryInput {
  childId: string | null // hoạt động của con nào (null = gia đình chưa thêm con)
  card: Pick<BabyCard, 'id' | 'name' | 'icon' | 'color'>
  start: Date
  minutes: number | null // null = chưa hoàn thành
}

// Hoạt động chưa hoàn thành: bắt đầu ở tương lai là "sắp bắt đầu", còn lại là "đang diễn ra"
export const entryState = (e: BabyEntry, now = new Date()) => (e.end ? 'done' : e.start > now ? 'upcoming' : 'ongoing')

// Hoạt động cuối cùng trong danh sách (giờ bắt đầu muộn nhất)
export const lastEntry = (entries: BabyEntry[]) =>
  entries.reduce<BabyEntry | null>((a, e) => (!a || e.start >= a.start ? e : a), null)

export const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60000)

// 90 -> "1 giờ 30 phút", 45 -> "45 phút", 120 -> "2 giờ"
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} phút`
  return m ? `${h} giờ ${m} phút` : `${h} giờ`
}

export const formatTime = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })

const pad = (n: number) => String(n).padStart(2, '0')
// Date -> "HH:MM" cho <input type="time">
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

// "HH:MM" + ngày -> Date
export function fromTimeInput(day: Date, value: string): Date | null {
  const m = value.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const d = new Date(day)
  d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return d
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
