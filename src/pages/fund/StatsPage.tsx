import { useState, type ReactNode } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { formatMoney, formatMoneyCompact } from '../../lib/format'
import { FundIcon, OrderRowSkeleton, PeriodBar, PeriodBarSkeleton } from './components'
import { useFund, useFundRuns } from './data/FundContext'
import { monthId, monthLabel, shiftMonth } from './data/orders'
import type { FundRun } from './data/types'
import { FundLineChart, SERIES_COLORS, type Series } from './FundLineChart'

// Thống kê số dư các nhóm quỹ, lấy từ số liệu lưu lại khi TỔNG KẾT ở màn hình Thực thi (fundRuns/{tháng}.balances).
// 2 tab để có nhiều chỗ:
//   - Theo tháng: số dư từng quỹ của tháng đã chọn + thay đổi so với tháng trước
//   - Biểu đồ năm: biểu đồ đường 12 tháng; chỉ vẽ đường của quỹ được chạm chọn (tránh rối khi có nhiều quỹ)

type Tab = 'month' | 'year'
const TABS: { value: Tab; label: string }[] = [
  { value: 'month', label: 'Theo tháng' },
  { value: 'year', label: 'Biểu đồ năm' },
]

const TOP_CLASS = 'space-y-3 !p-3'
const TABLE_CLASS = `${GLASS_CLASS} !p-0`
const CHIPS_CLASS = `${GLASS_CLASS} !p-3`
const CHART_PANEL = '!p-3'
const TOTAL_ID = '__total'
const MAX_LINES = SERIES_COLORS.length
const SKELETON_ROWS = 5

export function StatsPage() {
  const { loading } = useFund()
  const runs = useFundRuns()
  const [tab, setTab] = useState<Tab>('month')
  if (loading || !runs) return <StatsPageSkeleton />
  return (
    <PageShell>
      <AppHeader title="Thống kê" backTo="/fund" />
      {tab === 'month' ? <MonthTab runs={runs} tabs={<Segmented options={TABS} value={tab} onChange={setTab} />} /> : null}
      {tab === 'year' ? <YearTab runs={runs} tabs={<Segmented options={TABS} value={tab} onChange={setTab} />} /> : null}
    </PageShell>
  )
}

// Tên / icon / màu của quỹ: lấy theo quỹ hiện tại, quỹ đã xoá thì lấy theo số liệu đã lưu
function useFundLook() {
  const { funds } = useFund()
  return (id: string, saved?: { name: string; icon: string }) => {
    const f = funds.find((x) => x.id === id)
    return { name: f?.name ?? saved?.name ?? 'Quỹ đã xoá', icon: f?.icon ?? saved?.icon ?? '💰', color: f?.color ?? 'from-slate-400 to-slate-600', order: f ? funds.indexOf(f) : 999 }
  }
}

// ---- Tab "Theo tháng" ----
function MonthTab({ runs, tabs }: { runs: Map<string, FundRun>; tabs: ReactNode }) {
  const { showMoney } = useFund()
  const look = useFundLook()
  // Mặc định: tháng gần nhất đã tổng kết, chưa có thì tháng này
  const [month, setMonth] = useState(() => [...runs.values()].filter((r) => r.balances).map((r) => r.month).sort().pop() ?? monthId(new Date()))
  const run = runs.get(month)
  const prev = runs.get(shiftMonth(month, -1))
  const current = monthId(new Date())

  const rows = run?.balances
    ? Object.entries(run.balances)
        .map(([id, s]) => ({ id, s, ...look(id, s), before: prev?.balances?.[id]?.balance ?? null }))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    : []
  const change = run?.total != null && prev?.total != null ? run.total - prev.total : null

  return (
    <>
      <GlassPanel className={TOP_CLASS}>
        {tabs}
        <PeriodBar
          label={`${monthLabel(month)}${month === current ? ' (tháng này)' : ''}`}
          onPrev={() => setMonth(shiftMonth(month, -1))}
          onNext={() => setMonth(shiftMonth(month, 1))}
          onReset={() => setMonth(current)}
          nextDisabled={month >= current}
        />
      </GlassPanel>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Tổng số dư" value={run?.total != null ? showMoney(run.total) : '—'} />
        <Stat
          label="So với tháng trước"
          value={change === null ? '—' : `${change >= 0 ? '+' : '−'}${formatMoneyCompact(Math.abs(change))}`}
          tone={change === null ? '' : change >= 0 ? 'text-emerald-200' : 'text-rose-200'}
          title={change === null ? undefined : formatMoney(change)}
        />
      </div>
      <ScrollArea className={TABLE_CLASS}>
        {!run?.balances ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Icon3D emoji="📊" className="h-12 w-12" />
            <span className="text-sm leading-5 text-white/70">
              {monthLabel(month)} chưa tổng kết. Số dư các quỹ được lưu lại khi bấm tổng kết ở bước 2 của màn hình Thực thi.
            </span>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {rows.map((r) => {
              const diff = r.before === null ? null : r.s.balance - r.before
              return (
                <div key={r.id} className={`${SIZE.row} flex items-center gap-3 px-4`}>
                  <FundIcon icon={r.icon} color={r.color} box="h-10 w-10" img="h-7 w-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm leading-5 font-semibold">{r.name}</span>
                    <span className="block truncate text-xs leading-5 text-white/60">
                      {r.s.transferred ? 'Đã chuyển đi · không tính vào tổng' : diff === null ? 'Tháng trước chưa có số liệu' : 'So với tháng trước'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-sm leading-5 font-bold ${r.s.transferred ? 'text-white/50 line-through' : ''}`}>{showMoney(r.s.balance)}</span>
                    {diff !== null && (
                      <span className={`block text-xs leading-5 ${diff >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                        {diff >= 0 ? '+' : '−'}
                        {formatMoneyCompact(Math.abs(diff))}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </>
  )
}

function Stat({ label, value, tone = '', title }: { label: string; value: string; tone?: string; title?: string }) {
  return (
    <div
      className={`${SIZE.stat} flex flex-col justify-center rounded-2xl border border-white/20 bg-white/10 px-3 shadow-lg shadow-black/20 backdrop-blur-xl`}
    >
      <span className="truncate text-xs leading-4 text-white/60">{label}</span>
      <span className={`truncate text-base leading-6 font-bold ${tone}`} title={title}>
        {value}
      </span>
    </div>
  )
}

// ---- Tab "Biểu đồ năm" ----
function YearTab({ runs, tabs }: { runs: Map<string, FundRun>; tabs: ReactNode }) {
  const look = useFundLook()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  // Đường đang vẽ: id -> ô màu. Màu gắn theo quỹ lúc được chọn và giữ nguyên khi chọn / bỏ đường khác
  const [selected, setSelected] = useState<Map<string, number>>(() => new Map())
  const [error, setError] = useState('')

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const yearRuns = months.map((m) => runs.get(m)?.balances ?? null)
  const totals = months.map((m) => runs.get(m)?.total ?? null)

  // Các quỹ có số liệu trong năm (kể cả quỹ đã xoá), theo thứ tự quỹ hiện tại
  const ids = [...new Set(yearRuns.flatMap((b) => (b ? Object.keys(b) : [])))]
  const funds = ids
    .map((id) => {
      const saved = yearRuns.map((b) => b?.[id]).filter(Boolean).pop()
      return { id, ...look(id, saved) }
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const options = [{ id: TOTAL_ID, name: 'Tổng số dư', icon: '💰', color: 'from-amber-400 to-orange-500' }, ...funds]

  function toggle(id: string) {
    setError('')
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      const used = new Set(next.values())
      const slot = SERIES_COLORS.findIndex((_, i) => !used.has(i))
      if (slot < 0) {
        setError(`Chỉ vẽ tối đa ${MAX_LINES} đường cùng lúc, hãy bỏ chọn bớt.`)
        return prev
      }
      next.set(id, slot)
      return next
    })
  }

  const series: Series[] = options
    .filter((o) => selected.has(o.id))
    .map((o) => ({
      id: o.id,
      label: o.name,
      color: SERIES_COLORS[selected.get(o.id)!],
      values: o.id === TOTAL_ID ? totals : yearRuns.map((b) => b?.[o.id]?.balance ?? null),
    }))
  const hasData = yearRuns.some(Boolean)

  return (
    <>
      <GlassPanel className={TOP_CLASS}>
        {tabs}
        <PeriodBar
          label={`Năm ${year}`}
          onPrev={() => setYear(year - 1)}
          onNext={() => setYear(year + 1)}
          onReset={() => setYear(thisYear)}
          nextDisabled={year >= thisYear}
        />
      </GlassPanel>
      <GlassPanel className={CHART_PANEL}>
        <FundLineChart year={year} series={series} />
      </GlassPanel>
      {error && <Alert type="error">{error}</Alert>}
      {/* Chú thích + chọn đường: chạm để vẽ / bỏ; ô màu cho biết đường nào là quỹ nào */}
      <ScrollArea className={CHIPS_CLASS}>
        {!hasData ? (
          <p className="p-3 text-center text-sm leading-5 text-white/70">Năm {year} chưa có tháng nào tổng kết.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {options.map((o) => {
              const slot = selected.get(o.id)
              const on = slot !== undefined
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(o.id)}
                  className={`${SIZE.control} flex min-w-0 items-center gap-2 rounded-xl border px-3 text-left text-sm transition active:scale-95 ${
                    on ? 'border-white/60 bg-white/20 font-semibold' : 'border-white/20 bg-white/5 text-white/70'
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white/40"
                    style={{ background: on ? SERIES_COLORS[slot] : 'transparent' }}
                  />
                  <Icon3D emoji={o.icon} className="h-6 w-6 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </>
  )
}

export function StatsPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={TOP_CLASS}>
        <SegmentedSkeleton count={TABS.length} />
        <PeriodBarSkeleton />
      </GlassPanel>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
      </div>
      <ScrollArea className={`${TABLE_CLASS} !overflow-hidden`}>
        <div className="divide-y divide-white/10">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <OrderRowSkeleton key={i} />
          ))}
        </div>
      </ScrollArea>
    </PageShell>
  )
}
