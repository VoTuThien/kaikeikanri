import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { APPS } from '../apps'
import type { ShortcutEntry } from '../shortcuts'
import { LineIcon } from './ui/Fab'
import { Icon3D } from './ui/Icon3D'
import { Skeleton } from './ui/Skeleton'
import { BLOCK_3D } from './ui/style3d'
import { LONG_PRESS_CLASS, useLongPress } from './useLongPress'

// Ô ở màn hình chính kiểu Live Tile của Windows Phone (Metro): ô VUÔNG màu phẳng, icon ở giữa, tên nằm TRONG ô ở góc trái dưới.
// App con là ô vừa (rộng 2 cột × cao 2 hàng), phím tắt và ô "+" là ô nhỏ (1 × 1).

// Lưới 4 cột, khe hẹp đều nhau như màn hình Start của Windows Phone
export const HOME_GRID = 'grid grid-cols-4 gap-2'
export const WIDE_TILE = 'col-span-2'

const appById = new Map(APPS.map((a) => [a.id, a]))

// Mặt ô: nền màu phẳng + bóng đổ, icon nét ở giữa, tên ở góc trái dưới; `badge` = icon nhỏ của app con ở góc phải trên (phím tắt thuộc app nào)
export function IconFace({
  icon,
  name,
  gradient,
  badge,
  wide,
  children,
}: {
  icon: string
  name: string
  gradient: string
  badge?: string
  wide?: boolean
  children?: ReactNode
}) {
  return (
    <span className={`relative flex aspect-square w-full flex-col border border-white/20 bg-gradient-to-br text-left ${BLOCK_3D} ${gradient}`}>
      <span className="flex min-h-0 flex-1 items-center justify-center">
        <Icon3D emoji={icon} className={wide ? 'h-16 w-16' : 'h-9 w-9'} />
      </span>
      <span className={`truncate px-2 ${wide ? 'pb-2 text-sm leading-5' : 'pb-1.5 text-[11px] leading-4'} font-semibold`}>{name}</span>
      {badge && (
        <span className="absolute top-1.5 right-1.5 opacity-80">
          <Icon3D emoji={badge} className="h-3.5 w-3.5" />
        </span>
      )}
      {children}
    </span>
  )
}

// Màu nền và icon góc của phím tắt lấy theo app con chứa màn hình đó
export function shortcutLook(s: ShortcutEntry) {
  const app = appById.get(s.appId)
  return { gradient: app?.gradient ?? 'from-slate-400 to-slate-600', badge: app?.icon }
}

const TILE = 'block w-full transition active:scale-95'

// Nút gỡ có dấu "−"; thêm class vị trí (vd "-top-2 left-0") khi dùng
export const REMOVE_BADGE =
  'absolute z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-slate-500/90 text-lg leading-none font-bold shadow-md'

interface HomeIconProps {
  icon: string
  name: string
  gradient: string
  to?: string // chưa có = app sắp ra mắt
  badge?: string
  editing: boolean // đang ở chế độ gỡ phím tắt (icon đứng yên)
  onLongPress: () => void
  onRemove?: () => void // có = gỡ được (phím tắt); app con thì không gỡ được
  onOpen?: () => void // gọi khi chạm để mở (phím tắt dùng để đánh dấu "mở từ phím tắt")
  soon?: boolean
  wide?: boolean // ô vừa 2×2 (app con)
}

export function HomeIcon({ icon, name, gradient, to, badge, editing, onLongPress, onRemove, onOpen, soon, wide }: HomeIconProps) {
  const press = useLongPress(onLongPress)
  const content = (
    <>
      <IconFace icon={icon} name={name} gradient={gradient} badge={badge} wide={wide}>
        {soon && <span className="absolute top-1.5 right-1.5 bg-white/90 px-1.5 text-[10px] leading-4 font-semibold text-slate-700">Sắp có</span>}
      </IconFace>
    </>
  )

  return (
    <div className={`relative ${LONG_PRESS_CLASS} ${wide ? WIDE_TILE : ''}`} {...press}>
      <div>
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

// Ô "+" cuối lưới (ô nhỏ): mở màn hình chọn màn hình để tạo phím tắt
export function AddShortcutIcon() {
  return (
    <Link to="/shortcuts" className={TILE} aria-label="Thêm phím tắt">
      <span className="flex aspect-square w-full flex-col border-2 border-dashed border-white/40 bg-white/10">
        <span className="flex min-h-0 flex-1 items-center justify-center">
          <LineIcon icon="add" className="h-8 w-8" />
        </span>
        <span className="truncate px-2 pb-1.5 text-[11px] leading-4 font-semibold">Thêm</span>
      </span>
    </Link>
  )
}

export function HomeIconSkeleton({ wide }: { wide?: boolean }) {
  return <Skeleton className={`aspect-square w-full rounded-none ${wide ? WIDE_TILE : ''}`} />
}
