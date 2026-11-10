import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isShortcutEntry } from '../lib/shortcuts'
import { GlassPanel } from './ui/GlassPanel'
import { Skeleton } from './ui/Skeleton'
import { SIZE } from './ui/sizes'

const BACK = `${SIZE.control} w-12 shrink-0`

// Thanh tiêu đề của mỗi app con, có nút quay về màn hình chính.
// Màn hình được mở từ phím tắt ở màn hình chính thì nút quay lại về thẳng màn hình chính.
// `right`: phần tử nhỏ ở cuối thanh (vd avatar chọn con ở app Chăm con), cao tối đa SIZE.control.
// `subtitle`: dòng phụ nhỏ ngay dưới tiêu đề (vd người gửi / thời gian / số mục đã xong của ghi chú).
// Tiêu đề (h-8) + dòng phụ (h-4) = đúng chiều cao nút quay lại (h-12) nên thanh tiêu đề không cao thêm.
export function AppHeader({ title, subtitle, backTo = '/', right }: { title: string; subtitle?: ReactNode; backTo?: string; right?: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <GlassPanel className="flex items-center gap-3 !p-3">
      <Link
        to={isShortcutEntry(pathname) ? '/' : backTo}
        aria-label="Quay lại"
        className={`${BACK} flex items-center justify-center rounded-xl border border-white/25 bg-white/10 text-2xl transition hover:bg-white/20 active:scale-95`}
      >
        ‹
      </Link>
      <div className="min-w-0 flex-1">
        {/* Tiêu đề kiểu Metro: chữ thường, to, nét mảnh */}
        <h1 className={`${SIZE.title} truncate text-[26px] leading-8 font-light lowercase`}>{title}</h1>
        {subtitle && <p className={`${SUBTITLE} truncate text-xs text-white/70`}>{subtitle}</p>}
      </div>
      {right}
    </GlassPanel>
  )
}

const SUBTITLE = 'h-4 leading-4'

export function AppHeaderSkeleton({ right, subtitle }: { right?: ReactNode; subtitle?: boolean } = {}) {
  return (
    <GlassPanel className="flex items-center gap-3 !p-3">
      <Skeleton className={BACK} />
      <div className="min-w-0">
        <Skeleton className={`${SIZE.title} w-40`} />
        {subtitle && (
          <div className={`${SUBTITLE} flex items-center`}>
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
        )}
      </div>
      {right && <span className="ml-auto">{right}</span>}
    </GlassPanel>
  )
}
