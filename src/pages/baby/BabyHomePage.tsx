import { useState } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FeatureTile, FeatureTileSkeleton, type Feature } from '../../components/FeatureTile'
import { PageShell } from '../../components/PageShell'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { useBaby, useDayEntries } from './data/BabyContext'
import { formatTime } from './data/types'

// Chức năng chưa làm (chưa có `to`) hiện "Sắp có"
const FEATURES: Feature[] = [
  { icon: '🕒', label: 'Time line', hint: 'Ghi lại trong ngày', to: '/baby/timeline' },
  { icon: '📊', label: 'Thống kê', hint: 'Thời gian trong ngày', to: '/baby/stats' },
  { icon: '🏷️', label: 'Thẻ hoạt động', hint: 'Ăn, ngủ, chơi...', to: '/baby/cards' },
  { icon: '⚙️', label: 'Cài đặt', hint: 'Tuỳ chỉnh app Chăm con' },
]

export function BabyHomePage() {
  const { loading } = useBaby()
  // Mốc "hôm nay" lấy lúc mở màn hình
  const [now] = useState(() => new Date())
  const today = useDayEntries(now)
  if (loading || !today) return <BabyHomePageSkeleton />

  const last = today[today.length - 1]

  return (
    <PageShell>
      <AppHeader title="Chăm con" />
      <GlassPanel>
        <p className={`${SIZE.subtitle} text-sm leading-5 text-white/70`}>Hôm nay</p>
        <p className="h-10 truncate text-3xl leading-10 font-bold">{today.length} hoạt động</p>
        <p className={`${SIZE.subtitle} truncate text-sm leading-5 text-white/60`}>
          {last
            ? `Gần nhất: ${last.name} ${formatTime(last.start)} - ${last.end ? formatTime(last.end) : 'đang diễn ra'}`
            : 'Chưa ghi hoạt động nào hôm nay'}
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

export function BabyHomePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel>
        <Skeleton className={`${SIZE.subtitle} w-20 rounded-md`} />
        <Skeleton className="h-10 w-44" />
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
