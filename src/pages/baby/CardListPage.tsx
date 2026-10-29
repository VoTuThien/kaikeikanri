import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { FAB_SPACE, FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { CardRow, CardRowSkeleton } from './components'
import { useBaby } from './data/BabyContext'

// Chừa chút lề để bóng đổ của thẻ không bị cắt khi cuộn, và chừa chỗ cuối danh sách cho nút nổi
const LIST_CLASS = `-mx-1 space-y-3 px-1 py-1 ${FAB_SPACE}`

export function CardListPage() {
  const { loading, cards } = useBaby()
  if (loading) return <CardListPageSkeleton />

  return (
    <PageShell>
      <AppHeader title="Thẻ hoạt động" backTo="/baby" />
      <ScrollArea className={LIST_CLASS}>
        {cards.length === 0 ? (
          <GlassPanel className="space-y-4 text-center">
            <div className="flex h-12 justify-center">
              <Icon3D emoji="🏷️" className="h-12 w-12" />
            </div>
            <p className="text-sm leading-5 text-white/70">
              Chưa có thẻ nào. Bấm nút dấu cộng ở góc dưới để tạo các thẻ như Ăn, Ngủ, Chơi, Đi vệ sinh.
            </p>
          </GlassPanel>
        ) : (
          cards.map((c) => <CardRow key={c.id} card={c} />)
        )}
      </ScrollArea>
      <FabGroup>
        <FabLink to="/baby/cards/new" icon="add" label="Tạo thẻ hoạt động" />
      </FabGroup>
    </PageShell>
  )
}

export function CardListPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <CardRowSkeleton />
        <CardRowSkeleton />
        <CardRowSkeleton />
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
