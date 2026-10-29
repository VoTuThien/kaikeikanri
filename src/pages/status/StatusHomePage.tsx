import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FeatureTile, FeatureTileSkeleton, type Feature } from '../../components/FeatureTile'
import { PageShell } from '../../components/PageShell'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { useStatus } from './data/StatusContext'

// Chức năng chưa làm (chưa có `to`) hiện "Sắp có"
const FEATURES: Feature[] = [
  { icon: '👥', label: 'Trạng thái', hint: 'Ai đang ở đâu', to: '/status/live' },
  { icon: '📍', label: 'Địa điểm', hint: 'Tạo, sửa địa điểm', to: '/status/places' },
  { icon: '🗺️', label: 'Bản đồ mini', hint: 'Xếp địa điểm lên bàn cờ', to: '/status/map' },
  { icon: '⚙️', label: 'Cài đặt', hint: 'Tuỳ chỉnh app Trạng thái' },
]

export function StatusHomePage() {
  const { loading, places } = useStatus()
  if (loading) return <StatusHomePageSkeleton />

  const onBoard = places.filter((p) => p.cell).length

  return (
    <PageShell>
      <AppHeader title="Trạng thái" />
      <GlassPanel>
        <p className={`${SIZE.subtitle} text-sm leading-5 text-white/70`}>Địa điểm đã tạo</p>
        <p className="h-10 truncate text-3xl leading-10 font-bold">{places.length}</p>
        <p className={`${SIZE.subtitle} truncate text-sm leading-5 text-white/60`}>{onBoard} địa điểm đã đặt lên bản đồ mini</p>
      </GlassPanel>
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureTile key={f.label} {...f} />
        ))}
      </div>
    </PageShell>
  )
}

export function StatusHomePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel>
        <Skeleton className={`${SIZE.subtitle} w-28 rounded-md`} />
        <Skeleton className="h-10 w-16" />
        <Skeleton className={`${SIZE.subtitle} w-52 rounded-md`} />
      </GlassPanel>
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureTileSkeleton key={f.label} wide={f.wide} />
        ))}
      </div>
    </PageShell>
  )
}
