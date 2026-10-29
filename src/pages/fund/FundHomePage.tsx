import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FeatureTile, FeatureTileSkeleton, type Feature } from '../../components/FeatureTile'
import { PageShell } from '../../components/PageShell'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { useFund } from './data/FundContext'

const FEATURES: Feature[] = [
  { icon: '🗂️', label: 'Nhóm quỹ', hint: 'Tạo, sửa quỹ', to: '/fund/groups' },
  { icon: '➕', label: 'Nạp quỹ', hint: 'Thêm tiền vào quỹ', to: '/fund/deposit' },
  { icon: '➖', label: 'Rút quỹ', hint: 'Lấy tiền từ quỹ', to: '/fund/withdraw' },
  { icon: '🔍', label: 'Tra cứu', hint: 'Lịch sử nạp / rút', to: '/fund/history' },
  { icon: '⚙️', label: 'Cài đặt', hint: 'Tuỳ chỉnh app Quỹ', to: '/fund/settings', wide: true },
]

export function FundHomePage() {
  const { loading, funds, showMoney } = useFund()
  if (loading) return <FundHomePageSkeleton />

  const total = funds.reduce((s, f) => s + f.balance, 0)
  const withInterest = funds.filter((f) => f.interestRate > 0).length

  return (
    <PageShell>
      <AppHeader title="Quản lý quỹ" />
      <GlassPanel>
        <p className={`${SIZE.subtitle} text-sm leading-5 text-white/70`}>Tổng số dư</p>
        <p className="h-10 truncate text-3xl leading-10 font-bold">{showMoney(total)}</p>
        <p className={`${SIZE.subtitle} truncate text-sm leading-5 text-white/60`}>
          {funds.length} nhóm quỹ{withInterest > 0 ? ` · ${withInterest} quỹ có lãi` : ''}
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

export function FundHomePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel>
        <Skeleton className={`${SIZE.subtitle} w-24 rounded-md`} />
        <Skeleton className="h-10 w-48" />
        <Skeleton className={`${SIZE.subtitle} w-32 rounded-md`} />
      </GlassPanel>
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureTileSkeleton key={f.label} wide={f.wide} />
        ))}
      </div>
    </PageShell>
  )
}
