import { Link } from 'react-router-dom'
import { Icon3D } from './ui/Icon3D'
import { Skeleton } from './ui/Skeleton'
import { SIZE } from './ui/sizes'

export interface Feature {
  icon: string
  label: string
  hint: string
  to?: string // chưa có = chức năng sắp ra mắt
  wide?: boolean // trải hết hàng (mọi cột) để thẳng mép với các ô phía trên
}

const TILE = `${SIZE.tile} flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-black/20 backdrop-blur-xl`

// Ô chức năng ở trang chính của mỗi app con (đặt trong lưới 2 cột)
export function FeatureTile({ icon, label, hint, to, wide }: Feature) {
  const content = (
    <>
      <Icon3D emoji={icon} className="h-8 w-8" />
      {/* Ô hẹp (lưới 3 cột) thì chữ dài bị cắt bằng dấu "…" thay vì xuống dòng làm vỡ chiều cao ô */}
      <span className="max-w-full truncate px-2 text-sm leading-5 font-semibold">{label}</span>
      <span className="max-w-full truncate px-2 text-xs leading-4 text-white/50">{to ? hint : 'Sắp có'}</span>
    </>
  )
  const span = wide ? 'col-span-full' : ''
  return to ? (
    <Link to={to} className={`${TILE} ${span} transition hover:bg-white/15 active:scale-[0.98]`}>
      {content}
    </Link>
  ) : (
    <div className={`${TILE} ${span} opacity-60`} aria-disabled="true">
      {content}
    </div>
  )
}

export function FeatureTileSkeleton({ wide }: { wide?: boolean }) {
  return <Skeleton className={`${SIZE.tile} ${wide ? 'col-span-full' : ''} rounded-2xl`} />
}
