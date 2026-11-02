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
export function AppHeader({ title, backTo = '/', right }: { title: string; backTo?: string; right?: ReactNode }) {
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
      <h1 className={`${SIZE.title} min-w-0 flex-1 truncate text-xl leading-8 font-bold`}>{title}</h1>
      {right}
    </GlassPanel>
  )
}

export function AppHeaderSkeleton({ right }: { right?: ReactNode } = {}) {
  return (
    <GlassPanel className="flex items-center gap-3 !p-3">
      <Skeleton className={BACK} />
      <Skeleton className={`${SIZE.title} w-40`} />
      {right && <span className="ml-auto">{right}</span>}
    </GlassPanel>
  )
}
