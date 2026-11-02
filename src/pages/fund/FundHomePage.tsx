import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FeatureTile, FeatureTileSkeleton, type Feature } from '../../components/FeatureTile'
import { PageShell } from '../../components/PageShell'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { useFund } from './data/FundContext'

const FEATURES: Feature[] = [
  { icon: '🔍', label: 'Tra cứu', hint: 'Lịch sử nạp / rút', to: '/fund/history' },
  { icon: '➖', label: 'Rút quỹ', hint: 'Lấy tiền từ quỹ', to: '/fund/withdraw' },
  { icon: '➕', label: 'Nạp quỹ', hint: 'Thêm tiền vào quỹ', to: '/fund/deposit' },
  { icon: '🔄', label: 'Chuyển quỹ', hint: 'Từ quỹ này sang quỹ khác', to: '/fund/transfer' },
  { icon: '🗂️', label: 'Nhóm quỹ', hint: 'Tạo, sửa quỹ', to: '/fund/groups' },
  { icon: '⚙️', label: 'Cài đặt', hint: 'Tuỳ chỉnh app Quỹ', to: '/fund/settings' },
]

export function FundHomePage() {
  const { loading, funds, showMoney } = useFund()
  if (loading) return <FundHomePageSkeleton />

  // Quỹ đã chuyển đi không còn trong tài khoản nên không tính vào tổng
  const total = funds.reduce((s, f) => (f.transferred ? s : s + f.balance), 0)
  const withInterest = funds.filter((f) => f.interestRate > 0).length
  const transferred = funds.filter((f) => f.transferred).length

  return (
    <PageShell>
      <AppHeader title="Quản lý quỹ" />
      <GlassPanel>
        <p className={`${SIZE.subtitle} text-sm leading-5 text-white/70`}>Tổng số dư</p>
        <p className="h-10 truncate text-3xl leading-10 font-bold">{showMoney(total)}</p>
        <p className={`${SIZE.subtitle} truncate text-sm leading-5 text-white/60`}>
          {funds.length} nhóm quỹ{withInterest > 0 ? ` · ${withInterest} quỹ có lãi` : ''}
          {transferred > 0 ? ` · ${transferred} đã chuyển đi` : ''}
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
