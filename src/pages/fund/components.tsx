import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { LinkButton } from '../../components/ui/Button'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { BLOCK_3D, GLOSS_3D } from '../../components/ui/style3d'
import { SIZE } from '../../components/ui/sizes'
import { useAppScope } from '../../components/useAppScope'
import { MAX_MONEY, toDateInputValue } from '../../lib/format'
import { FundProvider, useFund } from './data/FundContext'
import { describeOrder } from './data/orders'
import type { Fund, FundOrder, OrderType } from './data/types'

// Bọc tất cả trang của app Quỹ: kiểm tra đăng nhập và tải dữ liệu quỹ một lần dùng chung
export function FundLayout() {
  const { redirect, actor, key } = useAppScope()
  if (redirect) return <Navigate to={redirect} replace />
  return (
    <FundProvider key={key} actor={actor}>
      <Outlet />
    </FundProvider>
  )
}

// Icon của quỹ: khối màu nổi 3D, bên trong là icon 3D ảnh
export function FundIcon({ icon, color, box = 'h-12 w-12', img = 'h-9 w-9' }: { icon: string; color: string; box?: string; img?: string }) {
  return (
    <span className={`${box} relative flex shrink-0 items-center justify-center bg-gradient-to-br ${BLOCK_3D} ${color}`}>
      <span className={GLOSS_3D} />
      <Icon3D emoji={icon} className={img} />
    </span>
  )
}

export function FundCardSkeleton() {
  return <Skeleton className={`${SIZE.listItem} rounded-2xl`} />
}

// Hiển thị khi chưa có dữ liệu
export function EmptyState({ icon, text, action }: { icon: string; text: string; action?: { to: string; label: string } }) {
  return (
    <GlassPanel className="space-y-4 text-center">
      <div className="flex h-12 justify-center">
        <Icon3D emoji={icon} className="h-12 w-12" />
      </div>
      <p className="text-sm leading-5 text-white/70">{text}</p>
      {action && (
        <LinkButton to={action.to} variant="primary">
          {action.label}
        </LinkButton>
      )}
    </GlassPanel>
  )
}

// ---- Lệnh chuyển (dùng ở màn hình Lệnh chuyển và bước 3 của màn hình Thực thi) ----

export const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'transfer', label: 'Chuyển' },
  { value: 'withdraw', label: 'Rút' },
  { value: 'deposit', label: 'Nạp' },
]

const ORDER_STYLE: Record<OrderType, { icon: string; badge: string; label: string }> = {
  transfer: { icon: '🔄', badge: 'from-sky-400/60 to-blue-700/60', label: 'Chuyển quỹ' },
  withdraw: { icon: '💸', badge: 'from-rose-400/60 to-rose-700/60', label: 'Rút tiền' },
  deposit: { icon: '💵', badge: 'from-emerald-400/60 to-emerald-700/60', label: 'Nạp tiền' },
}

// Nội dung 1 dòng lệnh: huy hiệu loại lệnh, mô tả (quỹ nào -> quỹ nào), ghi chú / trạng thái, số tiền
export function OrderInfo({ order, sub }: { order: FundOrder; sub?: ReactNode }) {
  const { funds, showMoney } = useFund()
  const nameOf = (id: string | null) => funds.find((f) => f.id === id)?.name ?? 'Quỹ đã xoá'
  const style = ORDER_STYLE[order.type]
  return (
    <>
      {/* Số thứ tự: lệnh chạy lần lượt theo số này */}
      <span className="w-6 shrink-0 text-center text-sm font-bold text-white/70 tabular-nums">{order.position}</span>
      <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${BLOCK_3D} ${style.badge}`}>
        <span className={GLOSS_3D} />
        <Icon3D emoji={style.icon} className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-semibold">{describeOrder(order, nameOf)}</span>
        <span className="block truncate text-xs leading-5 text-white/60">{sub ?? (order.note || style.label)}</span>
      </span>
      <span className="shrink-0 text-right text-sm font-bold">
        {order.allBalance ? <span className="block w-14 text-xs leading-4">Toàn bộ số dư</span> : showMoney(order.amount)}
      </span>
    </>
  )
}

// Lệnh còn chạy được không (quỹ trong lệnh có thể đã bị xoá)
export function orderValid(order: FundOrder, funds: Fund[]) {
  const has = (id: string | null) => !!id && funds.some((f) => f.id === id)
  if (order.type === 'transfer') return has(order.fromFundId) && has(order.toFundId) && order.fromFundId !== order.toFundId
  if (order.type === 'withdraw') return has(order.fromFundId)
  return has(order.toFundId)
}

export function OrderRowSkeleton() {
  return (
    <div className={`${SIZE.row} flex items-center gap-3 px-4`}>
      <Skeleton className="h-4 w-6 shrink-0 rounded-md" />
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <Skeleton className="h-4 w-20 rounded-md" />
    </div>
  )
}

// Thanh chọn kỳ (tháng / năm): ‹ kỳ trước, chạm giữa để về kỳ hiện tại, › kỳ sau (kỳ hiện tại thì khoá nút ›)
export const PERIOD_BAR = 'grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3'
const PERIOD_BUTTON = 'h-10 w-10 rounded-xl border border-white/25 bg-white/10 text-xl transition hover:bg-white/20 active:scale-95 disabled:opacity-30'

export function PeriodBar({
  label,
  onPrev,
  onNext,
  onReset,
  nextDisabled,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  onReset: () => void
  nextDisabled: boolean
}) {
  return (
    <div className={PERIOD_BAR}>
      <button type="button" aria-label="Kỳ trước" className={PERIOD_BUTTON} onClick={onPrev}>
        ‹
      </button>
      <button type="button" className="truncate text-center text-sm leading-5 font-semibold" onClick={onReset}>
        {label}
      </button>
      <button type="button" aria-label="Kỳ sau" className={PERIOD_BUTTON} disabled={nextDisabled} onClick={onNext}>
        ›
      </button>
    </div>
  )
}

export function PeriodBarSkeleton() {
  return (
    <div className={PERIOD_BAR}>
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mx-auto h-4 w-36 rounded-md" />
      <Skeleton className="h-10 w-10 rounded-xl" />
    </div>
  )
}

// Giá trị điền sẵn từ URL (?amount=&date=YYYY-MM-DD) cho màn hình nạp / rút / chuyển, vd khi nhập lại giao dịch đã xoá
export const prefillAmount = (params: URLSearchParams) => Math.min(Math.max(0, Math.floor(Number(params.get('amount')) || 0)), MAX_MONEY)
export const prefillDate = (params: URLSearchParams) => {
  const d = params.get('date')
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : toDateInputValue(new Date())
}
