import { Link } from 'react-router-dom'
import { Icon3D } from './ui/Icon3D'
import { Skeleton } from './ui/Skeleton'
import { SIZE } from './ui/sizes'

export interface Feature {
  icon: string
  label: string
  hint: string
  to?: string // chưa có = chức năng sắp ra mắt
  wide?: boolean | 2 // true = trải hết hàng (mọi cột), 2 = chiếm 2 cột; để thẳng mép với các ô phía trên
}

// Ô kính (gradient glass, có bóng đổ), vuông góc kiểu Live Tile: icon ở góc trái trên, tên + dòng phụ ở góc trái dưới
const TILE = `${SIZE.tile} flex w-full flex-col items-start justify-between border border-white/20 bg-gradient-to-br from-white/20 to-white/5 p-2.5 text-left shadow-lg shadow-black/25 backdrop-blur-xl`

const spanOf = (wide: Feature['wide']) => (wide === 2 ? 'col-span-2' : wide ? 'col-span-full' : '')

// Ô chức năng ở trang chính của mỗi app con (đặt trong lưới 2 cột)
export function FeatureTile({ icon, label, hint, to, wide }: Feature) {
  const content = (
    <>
      <Icon3D emoji={icon} className="h-8 w-8" />
      {/* Ô hẹp (lưới 3 cột) thì chữ dài bị cắt bằng dấu "…" thay vì xuống dòng làm vỡ chiều cao ô */}
      <span className="block w-full min-w-0">
        <span className="block truncate text-sm leading-5 font-semibold">{label}</span>
        <span className="block truncate text-xs leading-4 text-white/60">{to ? hint : 'Sắp có'}</span>
      </span>
    </>
  )
  const span = spanOf(wide)
  return to ? (
    <Link to={to} className={`${TILE} ${span} transition hover:from-white/25 active:scale-[0.97]`}>
      {content}
    </Link>
  ) : (
    <div className={`${TILE} ${span} opacity-60`} aria-disabled="true">
      {content}
    </div>
  )
}

export function FeatureTileSkeleton({ wide }: { wide?: Feature['wide'] }) {
  return <Skeleton className={`${SIZE.tile} ${spanOf(wide)} rounded-none`} />
}
