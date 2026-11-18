import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FeatureTile, FeatureTileSkeleton, type Feature } from '../../components/FeatureTile'
import { PageShell } from '../../components/PageShell'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { GardenStats, GardenStatsSkeleton } from './components'
import { plotState } from './data/crops'
import { useGarden, useNow } from './data/GardenContext'

// Ô chức năng: thêm ô mới thì thêm phím tắt tương ứng vào SHORTCUTS (src/shortcuts.ts)
const FEATURES: Feature[] = [
  { icon: '🌱', label: 'Vườn của tôi', hint: 'Gieo, tưới, thu hoạch', to: '/garden/farm' },
  { icon: '🧺', label: 'Kho nông sản', hint: 'Bán lấy xu', to: '/garden/barn' },
  { icon: '📖', label: 'Cẩm nang', hint: 'Các loại cây, cách chơi', to: '/garden/guide', wide: true },
]

export function GardenHomePage() {
  const { loading, garden } = useGarden()
  const now = useNow(5000)
  if (loading || !garden) return <GardenHomePageSkeleton />

  const states = garden.plots.slice(0, garden.unlocked).map((p) => plotState(p, now))
  const ripe = states.filter((s) => s?.ripe).length
  const care = states.filter((s) => s && (s.thirsty || s.hasBug)).length
  const empty = states.filter((s) => !s).length
  const stock = Object.values(garden.barn).reduce((a, b) => a + b, 0)

  return (
    <PageShell>
      <AppHeader title="Vườn mây" />
      <GardenStats garden={garden} />
      <GlassPanel>
        <p className={`${SIZE.subtitle} text-sm leading-5 text-white/70`}>Khu vườn hôm nay</p>
        <p className="h-10 truncate text-3xl leading-10 font-bold">{ripe ? `${ripe} cây đã chín` : care ? `${care} cây cần chăm` : 'Vườn đang lớn'}</p>
        <p className={`${SIZE.subtitle} truncate text-sm leading-5 text-white/60`}>
          {care} cần chăm · {empty} ô trống · {stock} nông sản trong kho
        </p>
      </GlassPanel>
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureTile key={f.label} {...f} />
        ))}
      </div>
    </PageShell>
  )
}

export function GardenHomePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GardenStatsSkeleton />
      <GlassPanel>
        <Skeleton className={`${SIZE.subtitle} w-28 rounded-md`} />
        <Skeleton className="h-10 w-48" />
        <Skeleton className={`${SIZE.subtitle} w-60 rounded-md`} />
      </GlassPanel>
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureTileSkeleton key={f.label} wide={f.wide} />
        ))}
      </div>
    </PageShell>
  )
}
