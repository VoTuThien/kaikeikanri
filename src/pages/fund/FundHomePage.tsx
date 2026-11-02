import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FeatureTile, FeatureTileSkeleton, type Feature } from '../../components/FeatureTile'
import { PageShell } from '../../components/PageShell'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { useFund } from './data/FundContext'

// 10 ô chức năng xếp lưới 3 cột (Cài đặt trải hết hàng cuối) cho vừa màn hình iPhone; chữ gợi ý ngắn để không bị cắt
const FEATURES: Feature[] = [
  { icon: '🔍', label: 'Tra cứu', hint: 'Lịch sử', to: '/fund/history' },
  { icon: '📊', label: 'Thống kê', hint: 'Số dư theo tháng', to: '/fund/stats' },
  { icon: '➖', label: 'Rút quỹ', hint: 'Lấy tiền ra', to: '/fund/withdraw' },
  { icon: '➕', label: 'Nạp quỹ', hint: 'Thêm tiền', to: '/fund/deposit' },
  { icon: '🔄', label: 'Chuyển quỹ', hint: 'Giữa 2 quỹ', to: '/fund/transfer' },
  { icon: '💼', label: 'Lương', hint: 'Ngày nhận, quỹ', to: '/fund/salary' },
  { icon: '📝', label: 'Lệnh chuyển', hint: 'Soạn sẵn', to: '/fund/orders' },
  { icon: '🚀', label: 'Thực thi', hint: 'Theo tháng', to: '/fund/execute' },
  { icon: '🗂️', label: 'Nhóm quỹ', hint: 'Tạo, sửa quỹ', to: '/fund/groups' },
  { icon: '⚙️', label: 'Cài đặt', hint: 'Tuỳ chỉnh app Quỹ', to: '/fund/settings', wide: true },
]

const GRID = 'grid grid-cols-3 gap-3'

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
      {/* Lưới 3 cột: mọi ô cùng kích thước và thẳng hàng */}
      <div className={GRID}>
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
      <div className={GRID}>
        {FEATURES.map((f) => (
          <FeatureTileSkeleton key={f.label} wide={f.wide} />
        ))}
      </div>
    </PageShell>
  )
}
