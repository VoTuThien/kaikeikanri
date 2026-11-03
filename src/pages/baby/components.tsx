import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
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

// Avatar của con: ảnh thật (nếu có) hoặc khối màu nổi 3D theo giới tính với icon 3D đã chọn.
// QUY ƯỚC: avatar LUÔN là HÌNH TRÒN ở mọi nơi. Khung là `block` / `flex` (span inline sẽ bỏ qua h / w, ảnh hiện nguyên hình vuông),
// ảnh `object-cover` + `rounded-full` và khung `overflow-hidden rounded-full` để chắc chắn cắt tròn cả trên iOS cũ.
export function ChildAvatar({
  child,
  box = 'h-12 w-12',
  img = 'h-9 w-9',
}: {
  child: Pick<Child, 'avatar' | 'gender' | 'photo'>
  box?: string
  img?: string
}) {
  if (child.photo) {
    return (
      <span className={`${box} relative block shrink-0 overflow-hidden rounded-full border-2 border-white/40 shadow-lg shadow-black/30`}>
        <img src={child.photo} alt="" className="block h-full w-full rounded-full object-cover" draggable={false} />
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
        <span className="block truncate text-base leading-6 font-semibold">
          {child.name}
          {child.nickname && <span className="font-normal text-white/60"> ({child.nickname})</span>}
        </span>
        <span className="block truncate text-xs leading-5 text-white/60">
          {[gender, child.birthDate && childAge(child.birthDate), birthLabel(child)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </Link>
  )
}

// Chọn con ở Time line và Thống kê: nằm trên thanh tiêu đề (`AppHeader right`), chỉ hiện avatar tròn của con đang chọn.
// Chạm avatar -> popup lưới avatar tròn của các con để chọn, ô cuối là "+" để thêm con.
const PICKER = `${SIZE.control} w-12`

export function ChildPicker() {
  const { children, child, selectChild } = useBaby()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function pick(id: string) {
    selectChild(id)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={child ? `Đang xem: ${child.name}. Chạm để chọn con khác` : 'Chọn con'}
        className={`${PICKER} flex shrink-0 items-center justify-center rounded-full transition active:scale-95`}
      >
        {child ? (
          <ChildAvatar child={child} box="h-12 w-12" img="h-9 w-9" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-white/40 bg-white/10 text-2xl">+</span>
        )}
      </button>
      {open &&
        // Vẽ ra document.body: không nằm trong GlassPanel (backdrop-blur làm position: fixed bị lệch)
        createPortal(
          <div
            data-no-swipe
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-24 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-label="Chọn con"
              className="w-full max-w-sm rounded-3xl border border-white/20 bg-indigo-950/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-3 text-center text-base leading-6 font-semibold">Chọn con</h2>
              <div className="grid max-h-[60vh] grid-cols-4 gap-x-2 gap-y-3 overflow-y-auto">
                {children.map((c) => (
                  <button key={c.id} type="button" onClick={() => pick(c.id)} className="flex flex-col items-center gap-1 transition active:scale-95">
                    <span className={`flex rounded-full p-0.5 ${c.id === child?.id ? 'bg-white' : ''}`}>
                      <ChildAvatar child={c} box="h-14 w-14" img="h-10 w-10" />
                    </span>
                    <span className="line-clamp-2 h-8 w-full text-center text-xs leading-4 break-words">{c.nickname || c.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => navigate('/baby/children/new')}
                  className="flex flex-col items-center gap-1 transition active:scale-95"
                >
                  <span className="flex p-0.5">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-white/50 bg-white/10 text-3xl">+</span>
                  </span>
                  <span className="h-8 text-xs leading-4 text-white/70">Thêm con</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

export function ChildPickerSkeleton() {
  return <Skeleton className={`${PICKER} rounded-full`} />
}
