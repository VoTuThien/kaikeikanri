import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon3D } from '../../components/ui/Icon3D'
import { formatMoney } from '../../lib/format'
import type { TxItem } from './data/types'

// Khung xem các sản phẩm trên hoá đơn (tên, SL, thành tiền), dùng chung cho:
// - Đọc hoá đơn: xem trước các sản phẩm sẽ lưu
// - Tra cứu: chạm giao dịch rút theo hoá đơn để xem đã mua những gì, bao nhiêu
// Vẽ ra document.body (không nằm trong GlassPanel), có data-no-swipe; chạm nền mờ hoặc "Đóng" để đóng.

// Số lượng: 0.274 -> "0,274"; 2 -> "2"
export const formatQty = (q: number) => q.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

export const itemsSum = (items: TxItem[]) => items.reduce((s, it) => s + it.amount, 0)

export function ReceiptItemsPopup({
  title,
  subtitle,
  items,
  paid,
  onClose,
}: {
  title: string
  subtitle?: ReactNode
  items: TxItem[]
  paid?: number // số tiền đã rút (so với tổng thành tiền)
  onClose: () => void
}) {
  const sum = itemsSum(items)
  return createPortal(
    <div data-no-swipe className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 rounded-2xl border border-white/20 bg-indigo-950/90 p-4 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Icon3D emoji="🛒" className="h-7 w-7 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm leading-5 font-semibold">{title}</span>
            {subtitle && <span className="block truncate text-xs leading-4 text-white/60">{subtitle}</span>}
          </span>
          <button type="button" onClick={onClose} className="h-8 shrink-0 rounded-lg bg-white/15 px-3 text-sm font-semibold">
            Đóng
          </button>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-white/10 overflow-auto rounded-xl bg-black/30 px-3">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-sm leading-5">
              <span className="w-5 shrink-0 text-right text-xs text-white/50 tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1">
                {/* Tên dài (vd "bột chiên giòn meizan có gia vị gói 150g") xuống tối đa 2 dòng để đọc trọn */}
                <span className="line-clamp-2 font-semibold">{it.name}</span>
                <span className="block text-xs leading-4 text-white/60">SL {formatQty(it.qty)}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(it.amount)}</span>
            </li>
          ))}
        </ul>
        {/* Tổng thành tiền các sản phẩm (và so với số đã rút nếu có) */}
        <div className="flex items-center justify-between gap-3 px-1 text-sm leading-5">
          <span className="text-white/70">{items.length} sản phẩm</span>
          <span className="font-bold tabular-nums">
            {formatMoney(sum)}
            {paid !== undefined && paid !== sum && <span className="ml-1 text-xs font-semibold text-amber-200">(đã rút {formatMoney(paid)})</span>}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
