import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { FAB_SPACE, FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { EmptyState, FundCard, FundCardSkeleton } from './components'
import { useFund } from './data/FundContext'

// Chừa chút lề để bóng đổ của thẻ không bị cắt khi cuộn, và chừa chỗ cuối danh sách cho nút nổi
const LIST_CLASS = `-mx-1 space-y-3 px-1 py-1 ${FAB_SPACE}`

export function FundListPage() {
  const { loading, funds } = useFund()
  if (loading) return <FundListPageSkeleton />

  return (
    <PageShell>
      <AppHeader title="Nhóm quỹ" backTo="/fund" />
      <ScrollArea className={LIST_CLASS}>
        {funds.length === 0 ? (
          <EmptyState icon="🗂️" text="Bạn chưa có nhóm quỹ nào. Bấm nút dấu cộng ở góc dưới để tạo quỹ đầu tiên, ví dụ: Chi tiêu hàng tháng, Quỹ cho con, Quỹ du lịch." />
        ) : (
          funds.map((f) => <FundCard key={f.id} fund={f} />)
        )}
      </ScrollArea>
      <FabGroup>
        <FabLink to="/fund/groups/new" icon="add" label="Tạo nhóm quỹ" />
      </FabGroup>
    </PageShell>
  )
}

export function FundListPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <FundCardSkeleton />
        <FundCardSkeleton />
        <FundCardSkeleton />
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
