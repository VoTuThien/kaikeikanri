import { Link } from 'react-router-dom'
import { GlassPanel } from './ui/GlassPanel'
import { Skeleton } from './ui/Skeleton'
import { SIZE } from './ui/sizes'

const BACK = `${SIZE.control} w-12 shrink-0`

// Thanh tiêu đề của mỗi app con, có nút quay về màn hình chính
export function AppHeader({ title, backTo = '/' }: { title: string; backTo?: string }) {
  return (
    <GlassPanel className="flex items-center gap-3 !p-3">
      <Link
        to={backTo}
        aria-label="Quay lại"
        className={`${BACK} flex items-center justify-center rounded-xl border border-white/25 bg-white/10 text-2xl transition hover:bg-white/20 active:scale-95`}
      >
        ‹
      </Link>
      <h1 className={`${SIZE.title} truncate text-xl leading-8 font-bold`}>{title}</h1>
    </GlassPanel>
  )
}

export function AppHeaderSkeleton() {
  return (
    <GlassPanel className="flex items-center gap-3 !p-3">
      <Skeleton className={BACK} />
      <Skeleton className={`${SIZE.title} w-40`} />
    </GlassPanel>
  )
}
