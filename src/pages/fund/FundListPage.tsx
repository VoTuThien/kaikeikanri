import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { useDragReorder } from '../../components/useDragReorder'
import { Alert } from '../../components/ui/Alert'
import { FAB_SPACE, FabGroup, FabLink, FabSkeleton, LineIcon } from '../../components/ui/Fab'
import { SwipeActions } from '../../components/ui/SwipeActions'
import { SIZE } from '../../components/ui/sizes'
import { formatPercent } from '../../lib/format'
import { EmptyState, FundCardSkeleton, FundIcon } from './components'
import { reorderFunds } from './data/api'
import { useFund } from './data/FundContext'
import type { Fund } from './data/types'

// Danh sách nhóm quỹ, xếp theo SỐ THỨ TỰ (cũng là thứ tự quỹ ở mọi ô chọn quỹ trong app):
// - Chạm thẻ: mở màn hình Nạp / Rút / Chuyển của quỹ đó
// - Trượt thẻ sang trái: hiện nút cây bút (icon nét trắng) -> chạm để sửa nhóm quỹ
// - Giữ tay cầm ≡ rồi kéo lên / xuống: đổi thứ tự (đánh số lại mọi quỹ cho liên tục, không trùng)

// Chừa chút lề để bóng đổ của thẻ không bị cắt khi cuộn, và chừa chỗ cuối danh sách cho nút nổi
const LIST_CLASS = `-mx-1 px-1 py-1 ${FAB_SPACE}`
const CARD = `${SIZE.listItem} flex items-center rounded-2xl border border-white/20 bg-white/10 pr-4 shadow-lg shadow-black/20 backdrop-blur-xl`
const HANDLE = 'flex h-full w-9 shrink-0 cursor-grab touch-none items-center justify-center text-lg text-white/50 active:cursor-grabbing'
const EDIT_WIDTH = 80
// Độ bo góc của thẻ (rounded-2xl = 16px): nền nút "Sửa" lấn sang trái bằng chừng này để góc bo của thẻ cũng có màu nút (nút thêm pl-4 cho chữ nằm giữa)
const CARD_RADIUS = 16

export function FundListPage() {
  const { loading, funds } = useFund()
  const navigate = useNavigate()
  // Thứ tự vừa kéo thả: hiện ngay trong lúc chờ Firestore cập nhật
  const [local, setLocal] = useState<Fund[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const key = funds.map((f) => f.id).join()
  useEffect(() => setLocal(null), [key])

  const list = local ?? funds
  const reorder = useDragReorder(list, (next) => {
    setError('')
    setOpenId(null)
    setLocal(next.map((f, i) => ({ ...f, position: i + 1 })))
    reorderFunds(next.map((f) => f.id)).catch((err) => {
      console.error(err)
      setLocal(null)
      setError('Lưu thứ tự thất bại. Vui lòng thử lại.')
    })
  })
  if (loading) return <FundListPageSkeleton />

  return (
    <PageShell>
      <AppHeader title="Nhóm quỹ" backTo="/fund" />
      {error && <Alert type="error">{error}</Alert>}
      <ScrollArea className={LIST_CLASS}>
        {list.length === 0 ? (
          <EmptyState text="Bạn chưa có nhóm quỹ nào. Bấm nút dấu cộng ở góc dưới để tạo quỹ đầu tiên, ví dụ: Chi tiêu hàng tháng, Quỹ cho con, Quỹ du lịch." icon="🗂️" />
        ) : (
          // Kéo ngang / dọc trong danh sách là thao tác của thẻ, không phải vuốt sang màn hình bên cạnh
          <div ref={reorder.listRef} className="space-y-3" data-no-swipe>
            {list.map((f, i) => (
              <div
                key={f.id}
                className={reorder.isDragging(i) ? 'relative z-10 scale-[1.02]' : 'relative transition-transform duration-150'}
                style={{ transform: `translateY(${reorder.offsetOf(i)}px)` }}
              >
                <SwipeActions
                  width={EDIT_WIDTH}
                  open={openId === f.id}
                  onOpen={() => setOpenId(f.id)}
                  onClose={() => setOpenId((id) => (id === f.id ? null : id))}
                  className="rounded-2xl"
                  radius={CARD_RADIUS}
                  actions={() => (
                    <button
                      type="button"
                      aria-label={`Sửa nhóm quỹ ${f.name}`}
                      onClick={() => navigate(`/fund/groups/${f.id}`)}
                      className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-sky-500/90 pl-4 text-[11px] font-semibold"
                    >
                      <LineIcon icon="edit" className="h-6 w-6" />
                      Sửa
                    </button>
                  )}
                >
                  <FundRow fund={f} index={reorder.displayIndex(i)} handle={reorder.handleProps(i)} />
                </SwipeActions>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <FabGroup>
        <FabLink to="/fund/groups/new" icon="add" label="Tạo nhóm quỹ" />
      </FabGroup>
    </PageShell>
  )
}

// 1 thẻ nhóm quỹ: tay cầm kéo thả | số thứ tự | icon, tên, lãi suất | số dư. Chạm (trừ tay cầm) mở Nạp / Rút / Chuyển
function FundRow({ fund, index, handle }: { fund: Fund; index: number; handle: ReturnType<ReturnType<typeof useDragReorder>['handleProps']> }) {
  const { showMoney } = useFund()
  return (
    <div className={CARD}>
      <button type="button" aria-label={`Kéo để đổi thứ tự quỹ số ${index}`} className={HANDLE} {...handle}>
        ≡
      </button>
      <Link to={`/fund/groups/${fund.id}/tx`} className="flex h-full min-w-0 flex-1 items-center gap-3">
        <span className="w-5 shrink-0 text-center text-sm font-bold text-white/70 tabular-nums">{index}</span>
        <FundIcon icon={fund.icon} color={fund.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base leading-6 font-semibold">{fund.name}</span>
          <span className="block truncate text-xs leading-5 text-white/60">
            {fund.transferred && 'Đã chuyển đi · '}
            {fund.interestRate > 0 ? `Lãi kép ${formatPercent(fund.interestRate)}/năm` : 'Không tính lãi'}
          </span>
        </span>
        {/* Quỹ đã chuyển đi: số dư mờ, gạch ngang vì không tính vào tổng */}
        <span className={`shrink-0 text-right text-sm font-bold ${fund.transferred ? 'text-white/50 line-through' : ''}`}>{showMoney(fund.balance)}</span>
      </Link>
    </div>
  )
}

export function FundListPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ScrollArea className={`${LIST_CLASS} space-y-3 !overflow-hidden`}>
        <FundCardSkeleton />
        <FundCardSkeleton />
        <FundCardSkeleton />
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
