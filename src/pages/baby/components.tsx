import { Link, Navigate, Outlet } from 'react-router-dom'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { BLOCK_3D, GLOSS_3D } from '../../components/ui/style3d'
import { useAppScope } from '../../components/useAppScope'
import { BabyProvider } from './data/BabyContext'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { addMinutes, formatDuration, sameDay, startOfDay, type BabyCard } from './data/types'

// Bọc tất cả trang của app Chăm con: kiểm tra đăng nhập và tải danh sách thẻ một lần dùng chung
export function BabyLayout() {
  const { redirect, actor, key } = useAppScope()
  if (redirect) return <Navigate to={redirect} replace />
  return (
    <BabyProvider key={key} actor={actor}>
      <Outlet />
    </BabyProvider>
  )
}

// Icon của thẻ: khối màu nổi 3D, bên trong là icon 3D ảnh
export function CardIcon({ icon, color, box = 'h-12 w-12', img = 'h-9 w-9' }: { icon: string; color: string; box?: string; img?: string }) {
  return (
    <span className={`${box} relative flex shrink-0 items-center justify-center rounded-[22%] bg-gradient-to-br ${BLOCK_3D} ${color}`}>
      <span className={GLOSS_3D} />
      <Icon3D emoji={icon} className={img} />
    </span>
  )
}

export function CardRow({ card }: { card: BabyCard }) {
  return (
    <Link
      to={`/baby/cards/${card.id}`}
      className={`${SIZE.listItem} flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 shadow-lg shadow-black/20 backdrop-blur-xl transition active:scale-[0.98]`}
    >
      <CardIcon icon={card.icon} color={card.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base leading-6 font-semibold">{card.name}</span>
        <span className="block truncate text-xs leading-5 text-white/60">Mặc định {formatDuration(card.defaultMinutes)}</span>
      </span>
    </Link>
  )
}

export function CardRowSkeleton() {
  return <Skeleton className={`${SIZE.listItem} rounded-2xl`} />
}

// Thanh chọn ngày dùng chung (Time line, Thống kê): ‹ ngày trước, chạm giữa để về hôm nay, › ngày sau
const DAY_BAR = `${SIZE.infoBar} grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3 !px-3 !py-0`
const DAY_BUTTON = 'h-10 w-10 rounded-xl border border-white/25 bg-white/10 text-xl transition hover:bg-white/20 active:scale-95'

function dayLabel(day: Date) {
  const today = startOfDay(new Date())
  const diff = Math.round((startOfDay(day).getTime() - today.getTime()) / 86400000)
  const date = day.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
  if (diff === 0) return `Hôm nay, ${date}`
  if (diff === -1) return `Hôm qua, ${date}`
  return date
}

export function DayBar({ day, onChange }: { day: Date; onChange: (day: Date) => void }) {
  const isToday = sameDay(day, new Date())
  // +1 giờ để qua được ngày đổi giờ mùa hè
  const shift = (offset: number) => onChange(startOfDay(addMinutes(day, offset * 24 * 60 + 60)))
  return (
    <GlassPanel className={DAY_BAR}>
      <button type="button" aria-label="Ngày trước" className={DAY_BUTTON} onClick={() => shift(-1)}>
        ‹
      </button>
      <button type="button" className="truncate text-center text-sm leading-5 font-semibold" onClick={() => onChange(startOfDay(new Date()))}>
        {dayLabel(day)}
      </button>
      <button type="button" aria-label="Ngày sau" className={`${DAY_BUTTON} disabled:opacity-30`} disabled={isToday} onClick={() => shift(1)}>
        ›
      </button>
    </GlassPanel>
  )
}

export function DayBarSkeleton() {
  return (
    <GlassPanel className={DAY_BAR}>
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mx-auto h-4 w-36 rounded-md" />
      <Skeleton className="h-10 w-10 rounded-xl" />
    </GlassPanel>
  )
}
