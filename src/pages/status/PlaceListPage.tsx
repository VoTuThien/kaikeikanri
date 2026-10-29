import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { FAB_SPACE, FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { PlaceCard, PlaceCardSkeleton } from './components'
import { useStatus } from './data/StatusContext'

// Chừa chút lề để bóng đổ của thẻ không bị cắt khi cuộn, và chừa chỗ cuối danh sách cho nút nổi
const LIST_CLASS = `-mx-1 space-y-3 px-1 py-1 ${FAB_SPACE}`

export function PlaceListPage() {
  const { loading, places } = useStatus()
  if (loading) return <PlaceListPageSkeleton />

  return (
    <PageShell>
      <AppHeader title="Địa điểm" backTo="/status" />
      <ScrollArea className={LIST_CLASS}>
        {places.length === 0 ? (
          <GlassPanel className="space-y-4 text-center">
            <div className="flex h-12 justify-center">
              <Icon3D emoji="📍" className="h-12 w-12" />
            </div>
            <p className="text-sm leading-5 text-white/70">
              Chưa có địa điểm nào. Bấm nút dấu cộng ở góc dưới để tạo các nơi hay lui tới như nhà, công ty, chợ, trạm xe buýt...
            </p>
          </GlassPanel>
        ) : (
          places.map((p) => <PlaceCard key={p.id} place={p} />)
        )}
      </ScrollArea>
      <FabGroup>
        <FabLink to="/status/places/new" icon="add" label="Tạo địa điểm" />
      </FabGroup>
    </PageShell>
  )
}

export function PlaceListPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <PlaceCardSkeleton />
        <PlaceCardSkeleton />
        <PlaceCardSkeleton />
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
