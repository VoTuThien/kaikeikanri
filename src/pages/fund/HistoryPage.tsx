import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { BLOCK_3D, GLOSS_3D } from '../../components/ui/style3d'
import { SIZE } from '../../components/ui/sizes'
import { formatDate, formatMoney, formatMoneyCompact, formatMonth } from '../../lib/format'
import { useFund } from './data/FundContext'
import type { FundTransaction, TxType } from './data/types'

type TypeFilter = 'all' | TxType

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'deposit', label: 'Nạp' },
  { value: 'withdraw', label: 'Rút' },
  { value: 'interest', label: 'Lãi' },
]

const TYPE_STYLE: Record<TxType, { icon: string; badge: string; sign: string; amount: string }> = {
  deposit: { icon: '💵', badge: 'from-emerald-400/60 to-emerald-700/60', sign: '+', amount: 'text-emerald-200' },
  withdraw: { icon: '💸', badge: 'from-rose-400/60 to-rose-700/60', sign: '−', amount: 'text-rose-200' },
  interest: { icon: '📈', badge: 'from-amber-300/60 to-amber-600/60', sign: '+', amount: 'text-amber-200' },
}

const TYPE_LABEL: Record<TxType, string> = { deposit: 'Nạp tiền', withdraw: 'Rút tiền', interest: 'Tiền lãi' }

// Bộ lọc thu gọn (ẩn nhãn, padding nhỏ) để dành chỗ cho bảng
const FILTER_CLASS = 'space-y-2 !p-3'
// Bảng: chiếm hết phần còn lại của màn hình, chỉ bảng được cuộn
const TABLE_CLASS = `${GLASS_CLASS} !p-0`
// Số dòng skeleton: đủ lấp đầy bảng trên iPhone 11 / 12, phần thừa bị che bởi khung bảng
const SKELETON_ROWS = 8

export function HistoryPage() {
  const { loading } = useFund()
  if (loading) return <HistoryPageSkeleton />
  return <History />
}

function History() {
  const { funds, transactions } = useFund()
  const [params] = useSearchParams()
  const [fundFilter, setFundFilter] = useState(params.get('fund') ?? 'all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const fundById = new Map(funds.map((f) => [f.id, f]))
  const byFund = transactions.filter((t) => fundFilter === 'all' || t.fundId === fundFilter)
  const shown = byFund.filter((t) => typeFilter === 'all' || t.type === typeFilter)

  // Tổng theo quỹ đang chọn (không phụ thuộc bộ lọc loại)
  const total = (type: TxType) => byFund.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)

  // Gom nhóm theo tháng, danh sách đã được sắp xếp mới nhất trước
  const groups: { month: string; items: FundTransaction[] }[] = []
  for (const t of shown) {
    const month = formatMonth(t.date)
    const last = groups[groups.length - 1]
    if (last?.month === month) last.items.push(t)
    else groups.push({ month, items: [t] })
  }

  return (
    <PageShell>
      <AppHeader title="Tra cứu" backTo="/fund" />

      <GlassPanel className={FILTER_CLASS}>
        <Select id="fund" label="Nhóm quỹ" hideLabel value={fundFilter} onChange={(e) => setFundFilter(e.target.value)}>
          <option value="all">Tất cả nhóm quỹ</option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.icon} {f.name}
            </option>
          ))}
        </Select>
        <Segmented options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
      </GlassPanel>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Tổng nạp" value={total('deposit')} className="text-emerald-200" />
        <Stat label="Tổng rút" value={total('withdraw')} className="text-rose-200" />
        <Stat label="Tiền lãi" value={total('interest')} className="text-amber-200" />
      </div>

      <ScrollArea className={TABLE_CLASS}>
        {groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Icon3D emoji="🔍" className="h-12 w-12" />
            <span className="text-sm leading-5 text-white/70">Chưa có giao dịch nào phù hợp.</span>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.month}>
              {/* Tiêu đề tháng dính trên đầu bảng khi cuộn */}
              <h2
                className={`${SIZE.stickyHeader} sticky top-0 z-10 border-b border-white/10 bg-indigo-950/70 px-6 text-xs leading-8 font-semibold text-white/70 backdrop-blur-xl`}
              >
                {g.month}
              </h2>
              <div className="divide-y divide-white/10">
                {g.items.map((t) => (
                  <TxRow key={t.id} tx={t} fundName={fundById.get(t.fundId)?.name ?? 'Quỹ đã xoá'} />
                ))}
              </div>
            </section>
          ))
        )}
      </ScrollArea>
    </PageShell>
  )
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div
      className={`${SIZE.stat} flex flex-col justify-center rounded-2xl border border-white/20 bg-white/10 px-3 shadow-lg shadow-black/20 backdrop-blur-xl`}
    >
      <span className="truncate text-xs leading-4 text-white/60">{label}</span>
      <span className={`truncate text-base leading-6 font-bold ${className}`} title={formatMoney(value)}>
        {formatMoneyCompact(value)}
      </span>
    </div>
  )
}

function TxRow({ tx, fundName }: { tx: FundTransaction; fundName: string }) {
  const style = TYPE_STYLE[tx.type]
  return (
    <div className={`${SIZE.row} flex items-center gap-3 px-6`}>
      <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${BLOCK_3D} ${style.badge}`}>
        <span className={GLOSS_3D} />
        <Icon3D emoji={style.icon} className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-semibold">{fundName}</span>
        <span className="block truncate text-xs leading-5 text-white/60">
          {[formatDate(tx.date), tx.createdByName, tx.note || TYPE_LABEL[tx.type]].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className={`shrink-0 text-sm font-bold ${style.amount}`}>
        {style.sign}
        {formatMoney(tx.amount)}
      </span>
    </div>
  )
}

export function HistoryPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={FILTER_CLASS}>
        <Skeleton className={`${SIZE.control} w-full`} />
        <SegmentedSkeleton count={TYPE_OPTIONS.length} />
      </GlassPanel>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
      </div>
      <ScrollArea className={`${TABLE_CLASS} !overflow-hidden`}>
        <div className={`${SIZE.stickyHeader} flex items-center border-b border-white/10 px-6`}>
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
        <div className="divide-y divide-white/10">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={i} className={`${SIZE.row} flex items-center gap-3 px-6`}>
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-md" />
              </div>
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </PageShell>
  )
}
