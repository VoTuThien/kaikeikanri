import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { APPS } from '../apps'
import type { ShortcutEntry } from '../shortcuts'
import { Icon3D } from './ui/Icon3D'
import { Skeleton } from './ui/Skeleton'
import { SIZE } from './ui/sizes'
import { BLOCK_3D, GLOSS_3D } from './ui/style3d'
import { LONG_PRESS_CLASS, useLongPress } from './useLongPress'

// Icon ở màn hình chính (app con, phím tắt, nút thêm): ô vuông bo góc + tên bên dưới, giống màn hình iPhone

// Lưới 4 cột như màn hình chính iPhone: icon luôn thẳng hàng theo cả hàng và cột
export const HOME_GRID = 'grid grid-cols-4 gap-x-2 gap-y-5'

const appById = new Map(APPS.map((a) => [a.id, a]))

// Khối icon: nền màu nổi 3D + icon 3D; `badge` = icon nhỏ của app con ở góc (để biết phím tắt thuộc app nào)
export function IconFace({ icon, gradient, badge, children }: { icon: string; gradient: string; badge?: string; children?: ReactNode }) {
  return (
    <span className={`${SIZE.appIcon} relative flex items-center justify-center rounded-[22%] bg-gradient-to-br ${BLOCK_3D} ${gradient}`}>
      <span className={GLOSS_3D} />
      <Icon3D emoji={icon} className="h-11 w-11" />
      {badge && (
        <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-indigo-950/80 shadow">
          <Icon3D emoji={badge} className="h-4 w-4" />
        </span>
      )}
      {children}
    </span>
  )
}

export function IconLabel({ children }: { children: ReactNode }) {
  return <span className={`${SIZE.appLabel} w-full truncate text-center text-xs leading-4 font-medium`}>{children}</span>
}

// Màu nền và icon góc của phím tắt lấy theo app con chứa màn hình đó
export function shortcutLook(s: ShortcutEntry) {
  const app = appById.get(s.appId)
  return { gradient: app?.gradient ?? 'from-slate-400 to-slate-600', badge: app?.icon }
}

const TILE = 'flex flex-col items-center gap-1.5 transition active:scale-95'

// Nút gỡ tròn có dấu "−" (giống iPhone); thêm class vị trí (vd "-top-2 left-0") khi dùng
export const REMOVE_BADGE =
  'absolute z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-slate-500/90 text-lg leading-none font-bold shadow-md'

interface HomeIconProps {
  icon: string
  name: string
  gradient: string
  to?: string // chưa có = app sắp ra mắt
  badge?: string
  editing: boolean // đang ở chế độ sắp xếp (icon rung)
  index: number // lệch nhịp rung giữa các icon cho tự nhiên
  onLongPress: () => void
  onRemove?: () => void // có = gỡ được (phím tắt); app con thì không gỡ được
  onOpen?: () => void // gọi khi chạm để mở (phím tắt dùng để đánh dấu "mở từ phím tắt")
  soon?: boolean
}

export function HomeIcon({ icon, name, gradient, to, badge, editing, index, onLongPress, onRemove, onOpen, soon }: HomeIconProps) {
  const press = useLongPress(onLongPress)
  const content = (
    <>
      <IconFace icon={icon} gradient={gradient} badge={badge}>
        {soon && (
          <span className="absolute -top-1.5 -right-1.5 rounded-full bg-white/90 px-1.5 text-[10px] leading-4 font-semibold text-slate-700">
            Sắp có
          </span>
        )}
      </IconFace>
      <IconLabel>{name}</IconLabel>
    </>
  )
  const jiggle = editing ? (index % 2 ? 'animate-jiggle' : 'animate-jiggle-alt') : ''

  return (
    <div className={`relative ${LONG_PRESS_CLASS}`} {...press}>
      <div className={jiggle}>
        {to && !editing ? (
          <Link to={to} className={TILE} draggable={false} onClick={onOpen}>
            {content}
          </Link>
        ) : (
          <div className={`${TILE} ${soon ? 'opacity-60' : ''}`} aria-disabled={!to || undefined}>
            {content}
          </div>
        )}
      </div>
      {/* Nút gỡ phím tắt (dấu trừ ở góc trên bên trái, giống iPhone) */}
      {editing && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Gỡ ${name}`}
          className={`${REMOVE_BADGE} -top-2 left-0`}
        >
          <span className="-mt-0.5">−</span>
        </button>
      )}
    </div>
  )
}

// Ô "+" cuối lưới: mở màn hình chọn màn hình để tạo phím tắt
export function AddShortcutIcon() {
  return (
    <Link to="/shortcuts" className={TILE} aria-label="Thêm phím tắt">
      <span className={`${SIZE.appIcon} flex items-center justify-center rounded-[22%] border-2 border-dashed border-white/40 bg-white/10 backdrop-blur-xl`}>
        <Icon3D emoji="➕" className="h-9 w-9" />
      </span>
      <IconLabel>Thêm</IconLabel>
    </Link>
  )
}

export function HomeIconSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Skeleton className={`${SIZE.appIcon} rounded-[22%]`} />
      <Skeleton className={`${SIZE.appLabel} w-10 rounded-md`} />
    </div>
  )
}
