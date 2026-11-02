import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { FAB_SPACE, FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { CardRowSkeleton, ChildRow } from './components'
import { useBaby } from './data/BabyContext'

// Danh sách các con của gia đình; chạm 1 con để sửa thông tin. Time line / thống kê đi theo từng con.
// Chừa chút lề để bóng đổ của thẻ không bị cắt khi cuộn, và chừa chỗ cuối danh sách cho nút nổi
const LIST_CLASS = `-mx-1 space-y-3 px-1 py-1 ${FAB_SPACE}`

export function ChildListPage() {
  const { loading, children } = useBaby()
  if (loading) return <ChildListPageSkeleton />

  return (
    <PageShell>
      <AppHeader title="Con" backTo="/baby" />
      <ScrollArea className={LIST_CLASS}>
        {children.length === 0 ? (
          <GlassPanel className="space-y-4 text-center">
            <div className="flex h-12 justify-center">
              <Icon3D emoji="👶" className="h-12 w-12" />
            </div>
            <p className="text-sm leading-5 text-white/70">
              Chưa có thông tin con. Bấm nút dấu cộng ở góc dưới để thêm con; time line và thống kê sẽ ghi riêng cho từng con.
            </p>
          </GlassPanel>
        ) : (
          children.map((c) => <ChildRow key={c.id} child={c} />)
        )}
      </ScrollArea>
      <FabGroup>
        <FabLink to="/baby/children/new" icon="add" label="Thêm con" />
      </FabGroup>
    </PageShell>
  )
}

export function ChildListPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <CardRowSkeleton />
        <CardRowSkeleton />
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
