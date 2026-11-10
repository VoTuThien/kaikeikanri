import { Link, Navigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../components/AppHeader'
import { PageShell } from '../components/PageShell'
import { GlassPanel } from '../components/ui/GlassPanel'
import { LineIcon } from '../components/ui/Fab'
import { Skeleton } from '../components/ui/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { sidePath, useShortcuts, type Side } from '../lib/shortcuts'

// Màn hình bên trái / phải của màn hình chính khi CHƯA thiết đặt: chỉ có dấu "+" để chọn màn hình.
// Đã thiết đặt thì vuốt ở màn hình chính sẽ vào thẳng màn hình đó (xem SideSwipe).

export const SIDE_TEXT: Record<Side, { title: string; open: string; back: string }> = {
  left: { title: 'Màn hình bên trái', open: 'vuốt sang phải', back: 'Vuốt sang trái' },
  right: { title: 'Màn hình bên phải', open: 'vuốt sang trái', back: 'Vuốt sang phải' },
}

const PLUS_SIZE = 'h-40 w-40 rounded-none'
const PLUS = `${PLUS_SIZE} flex items-center justify-center border-2 border-dashed border-white/40 bg-white/10`
const PANEL_CLASS = 'flex min-h-0 flex-1 flex-col items-center justify-center gap-5 text-center'

const isSide = (s: string | undefined): s is Side => s === 'left' || s === 'right'

export function SidePage() {
  const { side } = useParams()
  const { user } = useAuth()
  const launcher = useShortcuts(user?.uid)
  if (!isSide(side)) return <Navigate to="/" replace />

  // Đã thiết đặt (vd thiết đặt ở máy khác) thì mở thẳng màn hình đó
  const path = sidePath(side, launcher[side])
  if (path !== `/side/${side}`) return <Navigate to={path} replace />

  const text = SIDE_TEXT[side]
  return (
    <PageShell>
      <AppHeader title={text.title} backTo="/" />
      <GlassPanel className={PANEL_CLASS}>
        <Link to={`/shortcuts?side=${side}`} aria-label="Chọn màn hình" className={`${PLUS} transition active:scale-95`}>
          <LineIcon icon="add" className="h-20 w-20" />
        </Link>
        <p className="max-w-xs text-sm leading-6 text-white/80">
          Chưa thiết đặt màn hình nào. Chạm dấu + để chọn; sau đó ở màn hình chính chỉ cần {text.open} là vào thẳng màn hình đó.
        </p>
        <p className="text-xs leading-5 text-white/50">{text.back} để về màn hình chính</p>
      </GlassPanel>
    </PageShell>
  )
}

export function SidePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={PANEL_CLASS}>
        <Skeleton className={PLUS_SIZE} />
        <Skeleton className="h-12 w-64 rounded-md" />
        <Skeleton className="h-5 w-48 rounded-md" />
      </GlassPanel>
    </PageShell>
  )
}
