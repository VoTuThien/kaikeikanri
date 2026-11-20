import { Navigate, Outlet } from 'react-router-dom'
import { useAppScope } from '../../components/useAppScope'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { BLOCK_3D } from '../../components/ui/style3d'
import type { Garden } from './data/api'
import { formatCoins, levelProgress } from './data/crops'
import { GardenProvider } from './data/GardenContext'

// Bọc tất cả trang của app Vườn mây: kiểm tra đăng nhập / gia đình và tải vườn của mình một lần
export function GardenLayout() {
  const { redirect, actor, key } = useAppScope()
  if (redirect) return <Navigate to={redirect} replace />
  return (
    <GardenProvider key={key} actor={actor}>
      <Outlet />
    </GardenProvider>
  )
}

// Icon trong khối màu phẳng có bóng đổ (icon cây trồng, nông sản)
export function CropBlock({ icon, color, size = 'h-11 w-11', iconSize = 'h-7 w-7' }: { icon: string; color: string; size?: string; iconSize?: string }) {
  return (
    <span className={`${size} flex shrink-0 items-center justify-center bg-gradient-to-br ${color} ${BLOCK_3D}`}>
      <Icon3D emoji={icon} className={iconSize} />
    </span>
  )
}

// Thanh cấp độ + xu: dùng ở trang chính của app và màn hình Vườn
const STATS = 'h-14'

export function GardenStats({ garden }: { garden: Garden }) {
  const { level, have, need, max } = levelProgress(garden.xp)
  return (
    <GlassPanel className="grid grid-cols-[1fr_auto] items-center gap-4 !px-4 !py-3">
      <div className={`${STATS} flex min-w-0 flex-col justify-center gap-1.5`}>
        <p className="flex items-center gap-1.5 text-sm leading-5 font-semibold">
          <Icon3D emoji="⭐" className="h-5 w-5 text-yellow-200" />
          Cấp {level}
          <span className="truncate text-xs font-normal text-white/60">
            {max ? 'Cấp tối đa' : `${have}/${need} kinh nghiệm`}
          </span>
        </p>
        <div className="h-2.5 w-full overflow-hidden border border-white/20 bg-white/10">
          <div className="h-full bg-gradient-to-r from-yellow-300 to-amber-500 transition-all" style={{ width: `${(have / need) * 100}%` }} />
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xl leading-7 font-bold text-yellow-100">
        <Icon3D emoji="🪙" className="h-6 w-6" />
        {formatCoins(garden.coins)}
      </p>
    </GlassPanel>
  )
}

export function GardenStatsSkeleton() {
  return (
    <GlassPanel className="grid grid-cols-[1fr_auto] items-center gap-4 !px-4 !py-3">
      <div className={`${STATS} flex flex-col justify-center gap-1.5`}>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-2.5 w-full" />
      </div>
      <Skeleton className="h-7 w-20" />
    </GlassPanel>
  )
}
