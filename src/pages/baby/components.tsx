import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Select } from '../../components/ui/Select'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { BLOCK_3D, GLOSS_3D } from '../../components/ui/style3d'
import { useAppScope } from '../../components/useAppScope'
import { BabyProvider, useBaby } from './data/BabyContext'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { addMinutes, childAge, formatDuration, GENDER_COLORS, GENDERS, sameDay, startOfDay, type BabyCard, type Child } from './data/types'

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

// ---- Con ----

// Avatar của con: ảnh thật (nếu có) hoặc khối màu nổi 3D theo giới tính với icon 3D đã chọn
export function ChildAvatar({
  child,
  box = 'h-12 w-12',
  img = 'h-9 w-9',
}: {
  child: Pick<Child, 'avatar' | 'gender' | 'photo'>
  box?: string
  img?: string
}) {
  // Avatar con luôn là HÌNH TRÒN: ảnh thật, hoặc chưa có ảnh thì khối tròn màu theo giới tính + icon 3D
  if (child.photo) {
    return (
      <span className={`${box} relative shrink-0 overflow-hidden rounded-full border-2 border-white/40 shadow-lg shadow-black/30`}>
        <img src={child.photo} alt="" className="h-full w-full object-cover" draggable={false} />
      </span>
    )
  }
  return (
    <span className={`${box} relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${BLOCK_3D} ${GENDER_COLORS[child.gender]}`}>
      <span className={`${GLOSS_3D} rounded-full`} />
      <Icon3D emoji={child.avatar} className={img} />
    </span>
  )
}

// Ngày sinh "YYYY-MM-DD" (+ giờ sinh) -> "Sinh 05/03/2025 lúc 08:30"
export function birthLabel(child: Pick<Child, 'birthDate' | 'birthTime'>) {
  const [y, m, d] = child.birthDate.split('-')
  if (!y) return 'Chưa nhập ngày sinh'
  return `Sinh ${d}/${m}/${y}${child.birthTime ? ` lúc ${child.birthTime}` : ''}`
}

export function ChildRow({ child }: { child: Child }) {
  const gender = GENDERS.find((g) => g.value === child.gender)?.label
  return (
    <Link
      to={`/baby/children/${child.id}`}
      className={`${SIZE.listItem} flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 shadow-lg shadow-black/20 backdrop-blur-xl transition active:scale-[0.98]`}
    >
      <ChildAvatar child={child} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base leading-6 font-semibold">{child.name}</span>
        <span className="block truncate text-xs leading-5 text-white/60">
          {[gender, child.birthDate && childAge(child.birthDate), birthLabel(child)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </Link>
  )
}

// Ô chọn con (giống ô chọn gia đình ở màn hình chính): sổ xuống rồi chọn; có thêm "Thêm con" / "Quản lý con".
// Dùng ở Time line và Thống kê. Gia đình 1 con thì đã chọn sẵn, không phải làm gì.
const ADD_CHILD = '__add'
const MANAGE_CHILDREN = '__manage'

export function ChildSelect() {
  const { children, child, selectChild } = useBaby()
  const navigate = useNavigate()
  function onChange(value: string) {
    if (value === ADD_CHILD) return navigate('/baby/children/new')
    if (value === MANAGE_CHILDREN) return navigate('/baby/children')
    selectChild(value)
  }
  return (
    <Select id="child" label="Con" hideLabel value={child?.id ?? ''} onChange={(e) => onChange(e.target.value)}>
      {!child && <option value="">Chưa thêm con</option>}
      {children.map((c) => (
        <option key={c.id} value={c.id}>
          {c.avatar} {c.name}
          {c.birthDate ? ` (${childAge(c.birthDate)})` : ''}
        </option>
      ))}
      <option disabled>──────────</option>
      <option value={ADD_CHILD}>+ Thêm con</option>
      <option value={MANAGE_CHILDREN}>Quản lý con...</option>
    </Select>
  )
}

export function ChildSelectSkeleton() {
  return <Skeleton className={`${SIZE.control} w-full`} />
}
