import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { useDragReorder } from '../../components/useDragReorder'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { FAB_SPACE, FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { GLASS_CLASS } from '../../components/ui/GlassPanel'
import { LIST_DRAGGING } from '../../components/ui/listStyle'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { EmptyState, OrderInfo, OrderRowSkeleton, orderValid } from './components'
import { useFund } from './data/FundContext'
import { reorderOrders } from './data/orders'
import type { FundOrder } from './data/types'

// Lệnh chuyển soạn sẵn: chuyển từ quỹ nào sang quỹ nào, rút từ quỹ nào, nạp vào quỹ nào, bao nhiêu tiền (hoặc toàn bộ số dư).
// Mỗi lệnh có SỐ THỨ TỰ; bước 3 của màn hình Thực thi chạy lần lượt theo số này.
// Đổi thứ tự: kéo tay cầm (≡) bên trái mỗi lệnh lên / xuống, hoặc sửa "Số thứ tự" trong form lệnh.
// Danh sách chiếm phần còn lại, chỉ danh sách cuộn.

const LIST_CLASS = `${GLASS_CLASS} !p-0 ${FAB_SPACE}`
const HANDLE = 'flex h-full w-10 shrink-0 cursor-grab touch-none items-center justify-center text-lg text-white/50 active:cursor-grabbing'
const SKELETON_ROWS = 6

export function OrderListPage() {
  const { loading, funds, orders } = useFund()
  // Thứ tự vừa kéo thả: hiện ngay trong lúc chờ Firestore cập nhật
  const [local, setLocal] = useState<FundOrder[] | null>(null)
  const [error, setError] = useState('')

  // Firestore trả về thứ tự mới thì bỏ thứ tự tạm
  const key = orders.map((o) => o.id).join()
  useEffect(() => setLocal(null), [key])

  const list = local ?? orders
  const reorder = useDragReorder(list, (next) => {
    setError('')
    // Đánh số lại 1, 2, 3... cho cả danh sách
    setLocal(next.map((o, i) => ({ ...o, position: i + 1 })))
    reorderOrders(next.map((o) => o.id)).catch((err) => {
      console.error(err)
      setLocal(null)
      setError('Lưu thứ tự thất bại. Vui lòng thử lại.')
    })
  })
  if (loading) return <OrderListPageSkeleton />

  return (
    <PageShell>
      <AppHeader title="Lệnh chuyển" backTo="/fund" />
      {error && <Alert type="error">{error}</Alert>}
      {list.length === 0 ? (
        <EmptyState
          icon="📝"
          text="Chưa có lệnh chuyển nào. Bấm nút dấu cộng để soạn sẵn lệnh, ví dụ: chuyển 2 triệu từ Chi tiêu hàng tháng sang Quỹ cho con. Các lệnh sẽ được chạy lần lượt theo số thứ tự ở màn hình Thực thi."
        />
      ) : (
        <ScrollArea className={LIST_CLASS}>
          {/* Kéo lên / xuống không phải vuốt sang màn hình bên cạnh */}
          <div ref={reorder.listRef} className="divide-y divide-white/10" data-no-swipe>
            {list.map((o, i) => {
              const dragging = reorder.isDragging(i)
              return (
                <div
                  key={o.id}
                  className={`${SIZE.row} relative flex items-center ${dragging ? LIST_DRAGGING : 'transition-transform duration-150'}`}
                  style={{ transform: `translateY(${reorder.offsetOf(i)}px)` }}
                >
                  <button type="button" aria-label={`Kéo để đổi thứ tự lệnh số ${i + 1}`} className={HANDLE} {...reorder.handleProps(i)}>
                    ≡
                  </button>
                  <Link to={`/fund/orders/${o.id}`} className="flex h-full min-w-0 flex-1 items-center gap-3 pr-4 transition hover:bg-white/5">
                    <OrderInfo
                      order={{ ...o, position: reorder.displayIndex(i) }}
                      sub={orderValid(o, funds) ? undefined : <span className="text-rose-200">Quỹ đã bị xoá, hãy sửa lại lệnh</span>}
                    />
                  </Link>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
      <FabGroup>
        <FabLink to="/fund/orders/new" icon="add" label="Tạo lệnh chuyển" />
      </FabGroup>
    </PageShell>
  )
}

export function OrderListPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <div className="divide-y divide-white/10">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={i} className="flex items-center">
              <div className="flex w-10 shrink-0 justify-center">
                <Skeleton className="h-4 w-4 rounded-md" />
              </div>
              <div className="min-w-0 flex-1 [&>div]:pl-0">
                <OrderRowSkeleton />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
