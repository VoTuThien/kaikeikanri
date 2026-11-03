import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FeatureTile, FeatureTileSkeleton, type Feature } from '../../components/FeatureTile'
import { PageShell } from '../../components/PageShell'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { useNote } from './data/NoteContext'
import { noteDone } from './data/types'

// Ô chức năng: thêm ô mới thì thêm phím tắt tương ứng vào SHORTCUTS (src/shortcuts.ts), trừ Cài đặt
const FEATURES: Feature[] = [
  { icon: '📬', label: 'Xem ghi chú', hint: 'Ghi chú gửi đến bạn', to: '/note/inbox' },
  { icon: '✍️', label: 'Tạo ghi chú', hint: 'Gửi cho người nhà', to: '/note/sent' },
  { icon: '🏷️', label: 'Thẻ ghi chú', hint: 'Gợi ý khi nhập', to: '/note/cards' },
  { icon: '⚙️', label: 'Cài đặt', hint: 'Quỹ mặc định', to: '/note/settings' },
]

export function NoteHomePage() {
  const { loading, inbox, cards } = useNote()
  if (loading) return <NoteHomePageSkeleton />

  const left = inbox.reduce((n, note) => n + note.items.filter((i) => !i.done).length, 0)

  return (
    <PageShell>
      <AppHeader title="Ghi chú" />
      <GlassPanel>
        <p className={`${SIZE.subtitle} text-sm leading-5 text-white/70`}>Việc cần làm</p>
        <p className="h-10 truncate text-3xl leading-10 font-bold">{left} thẻ chưa xong</p>
        <p className={`${SIZE.subtitle} truncate text-sm leading-5 text-white/60`}>
          {inbox.length} ghi chú gửi đến bạn · {inbox.filter(noteDone).length} đã hoàn thành · {cards.length} thẻ gợi ý
        </p>
      </GlassPanel>
      {/* Lưới 2 cột: mọi ô cùng kích thước và thẳng hàng */}
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureTile key={f.label} {...f} />
        ))}
      </div>
    </PageShell>
  )
}

export function NoteHomePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel>
        <Skeleton className={`${SIZE.subtitle} w-24 rounded-md`} />
        <Skeleton className="h-10 w-52" />
        <Skeleton className={`${SIZE.subtitle} w-56 rounded-md`} />
      </GlassPanel>
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureTileSkeleton key={f.label} wide={f.wide} />
        ))}
      </div>
    </PageShell>
  )
}
