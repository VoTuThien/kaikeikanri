import { Link, Navigate, Outlet } from 'react-router-dom'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { BLOCK_3D, GLOSS_3D } from '../../components/ui/style3d'
import { useAppScope } from '../../components/useAppScope'
import { StatusProvider } from './data/StatusContext'
import { placeTypeInfo, type Place, type PlaceType } from './data/types'

// Bọc tất cả trang của app Trạng thái: kiểm tra đăng nhập và tải dữ liệu một lần dùng chung
export function StatusLayout() {
  const { redirect, actor, key } = useAppScope()
  if (redirect) return <Navigate to={redirect} replace />
  return (
    <StatusProvider key={key} actor={actor}>
      <Outlet />
    </StatusProvider>
  )
}

// Màu khối nền icon theo loại địa điểm
const TYPE_COLOR: Record<PlaceType, string> = {
  house: 'from-amber-300 to-orange-500',
  market: 'from-rose-400 to-red-600',
  company: 'from-sky-400 to-blue-600',
  tram: 'from-emerald-400 to-green-600',
  bus: 'from-yellow-300 to-amber-500',
  supermarket: 'from-orange-400 to-orange-600',
  hospital: 'from-slate-200 to-slate-400',
}

export function PlaceIcon({ type, box = 'h-12 w-12', img = 'h-9 w-9' }: { type: PlaceType; box?: string; img?: string }) {
  return (
    <span className={`${box} relative flex shrink-0 items-center justify-center rounded-[22%] bg-gradient-to-br ${BLOCK_3D} ${TYPE_COLOR[type]}`}>
      <span className={GLOSS_3D} />
      <Icon3D emoji={placeTypeInfo(type).emoji} className={img} />
    </span>
  )
}

export function PlaceCard({ place }: { place: Place }) {
  const info = placeTypeInfo(place.type)
  return (
    <Link
      to={`/status/places/${place.id}`}
      className={`${SIZE.listItem} flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 shadow-lg shadow-black/20 backdrop-blur-xl transition active:scale-[0.98]`}
    >
      <PlaceIcon type={place.type} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base leading-6 font-semibold">{place.name}</span>
        <span className="block truncate text-xs leading-5 text-white/60">
          {[info.label, place.note].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0 text-right text-[11px] leading-4 text-white/50 tabular-nums">
        {place.lat.toFixed(4)}
        <br />
        {place.lng.toFixed(4)}
      </span>
    </Link>
  )
}

// Avatar dùng chung cả app (tag trên bản đồ, danh sách "Ai đang ở đâu")
export { Avatar } from '../../components/Avatar'

export function PlaceCardSkeleton() {
  return <Skeleton className={`${SIZE.listItem} rounded-2xl`} />
}
