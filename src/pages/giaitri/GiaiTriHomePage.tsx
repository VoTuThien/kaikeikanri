import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FeatureTile, FeatureTileSkeleton, type Feature } from '../../components/FeatureTile'
import { PageShell } from '../../components/PageShell'
import { GardenStats, GardenStatsSkeleton } from '../garden/components'
import { useGarden } from '../garden/data/GardenContext'
import { GAME_PATH } from '../garden/game/constants'

// App con Giải trí: menu các trò chơi. Game Vườn mây mở toàn màn hình ngang (GAME_PATH), nút thoát trong game quay về đây.
// Thêm ô mở màn hình mới thì thêm phím tắt tương ứng vào SHORTCUTS (src/shortcuts.ts).
const FEATURES: Feature[] = [
  { icon: '🪴', label: 'Vườn mây', hint: 'Trồng cây trên các tầng mây', to: GAME_PATH, wide: true },
  { icon: '🎮', label: 'Trò chơi khác', hint: 'Sắp có' },
]

export function GiaiTriHomePage() {
  const { loading, garden } = useGarden()
  if (loading || !garden) return <GiaiTriHomePageSkeleton />
  return (
    <PageShell>
      <AppHeader title="Giải trí" />
      <GardenStats garden={garden} />
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureTile key={f.label} {...f} />
        ))}
      </div>
    </PageShell>
  )
}

export function GiaiTriHomePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GardenStatsSkeleton />
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureTileSkeleton key={f.label} wide={f.wide} />
        ))}
      </div>
    </PageShell>
  )
}
