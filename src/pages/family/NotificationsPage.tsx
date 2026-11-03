import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { NotificationList, NotificationListSkeleton } from './NotificationList'

// Trang Thông báo (vẫn mở được bằng URL / phím tắt). Bình thường chạm bong bóng thông báo sẽ mở POPUP cùng nội dung
// ngay trên màn hình đang xem (NotificationBubble), không phải rời màn hình.
export function NotificationsPage() {
  return (
    <PageShell>
      <AppHeader title="Thông báo" backTo="/" />
      <ScrollArea>
        <NotificationList />
      </ScrollArea>
    </PageShell>
  )
}

export function NotificationsPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ScrollArea className="!overflow-hidden">
        <NotificationListSkeleton />
      </ScrollArea>
    </PageShell>
  )
}
