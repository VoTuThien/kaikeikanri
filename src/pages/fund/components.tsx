import { Link, Navigate, Outlet } from 'react-router-dom'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { LinkButton } from '../../components/ui/Button'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { BLOCK_3D, GLOSS_3D } from '../../components/ui/style3d'
import { SIZE } from '../../components/ui/sizes'
import { useAppScope } from '../../components/useAppScope'
import { formatPercent } from '../../lib/format'
import { FundProvider, useFund } from './data/FundContext'
import type { Fund } from './data/types'

// Bọc tất cả trang của app Quỹ: kiểm tra đăng nhập và tải dữ liệu quỹ một lần dùng chung
export function FundLayout() {
  const { redirect, actor, key } = useAppScope()
  if (redirect) return <Navigate to={redirect} replace />
  return (
    <FundProvider key={key} actor={actor}>
      <Outlet />
    </FundProvider>
  )
}

// Icon của quỹ: khối màu nổi 3D, bên trong là icon 3D ảnh
export function FundIcon({ icon, color, box = 'h-12 w-12', img = 'h-9 w-9' }: { icon: string; color: string; box?: string; img?: string }) {
  return (
    <span className={`${box} relative flex shrink-0 items-center justify-center rounded-[22%] bg-gradient-to-br ${BLOCK_3D} ${color}`}>
      <span className={GLOSS_3D} />
      <Icon3D emoji={icon} className={img} />
    </span>
  )
}

export function FundCard({ fund }: { fund: Fund }) {
  const { showMoney } = useFund()
  return (
    <Link
      to={`/fund/groups/${fund.id}`}
      className={`${SIZE.listItem} flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 shadow-lg shadow-black/20 backdrop-blur-xl transition active:scale-[0.98]`}
    >
      <FundIcon icon={fund.icon} color={fund.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base leading-6 font-semibold">{fund.name}</span>
        <span className="block truncate text-xs leading-5 text-white/60">
          {fund.interestRate > 0 ? `Lãi kép ${formatPercent(fund.interestRate)}/năm` : 'Không tính lãi'}
        </span>
      </span>
      <span className="shrink-0 text-right text-sm font-bold">{showMoney(fund.balance)}</span>
    </Link>
  )
}

export function FundCardSkeleton() {
  return <Skeleton className={`${SIZE.listItem} rounded-2xl`} />
}

// Hiển thị khi chưa có dữ liệu
export function EmptyState({ icon, text, action }: { icon: string; text: string; action?: { to: string; label: string } }) {
  return (
    <GlassPanel className="space-y-4 text-center">
      <div className="flex h-12 justify-center">
        <Icon3D emoji={icon} className="h-12 w-12" />
      </div>
      <p className="text-sm leading-5 text-white/70">{text}</p>
      {action && (
        <LinkButton to={action.to} variant="primary">
          {action.label}
        </LinkButton>
      )}
    </GlassPanel>
  )
}
