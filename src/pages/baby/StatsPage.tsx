import { useEffect, useState } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { CardIcon, DayBar, DayBarSkeleton } from './components'
import { useBaby, useDayEntries } from './data/BabyContext'
import { compactDuration, dayStats, niceScale, type ActivityStat } from './data/stats'
import { formatDuration, startOfDay, type BabyEntry } from './data/types'

// Biểu đồ cột: chiều cao cố định (dùng chung với skeleton), danh sách bên dưới chiếm phần còn lại
const CHART_CLASS = 'flex h-64 flex-col gap-2 !p-4'
const TABLE_CLASS = `${GLASS_CLASS} !p-0`
const STAT_CLASS = `${SIZE.stat} flex flex-col justify-center rounded-2xl border border-white/20 bg-white/10 px-3 shadow-lg shadow-black/20 backdrop-blur-xl`
const ROW = 'h-14'
// Cột trục dọc (nhãn giờ) và vùng icon dưới trục ngang: dùng chung để cột thẳng với icon
const Y_AXIS = 'w-8 shrink-0'
const X_AXIS = 'h-7'
// Nhiều cột quá thì chỉ ghi số trên cột đang chọn, còn lại xem ở danh sách
const MAX_LABELED = 6
const SKELETON_BARS = ['h-[70%]', 'h-[45%]', 'h-[30%]', 'h-[20%]']
const SKELETON_ROWS = 4

// Đồng hồ cập nhật mỗi phút, để thời gian của hoạt động đang diễn ra tăng dần
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function StatsPage() {
  const { loading } = useBaby()
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const entries = useDayEntries(day)
  if (loading) return <StatsPageSkeleton />
  return <Stats day={day} setDay={setDay} entries={entries} />
}

function Stats({ day, setDay, entries }: { day: Date; setDay: (d: Date) => void; entries: BabyEntry[] | null }) {
  const now = useNow()
  const [selected, setSelected] = useState<string | null>(null)
  const stats = entries ? dayStats(entries, now) : null
  const total = stats?.reduce((a, s) => a + s.minutes, 0) ?? 0
  const times = stats?.reduce((a, s) => a + s.count, 0) ?? 0
  const toggle = (key: string) => setSelected((k) => (k === key ? null : key))

  function changeDay(next: Date) {
    setSelected(null)
    setDay(next)
  }

  return (
    <PageShell>
      <AppHeader title="Thống kê" backTo="/baby" />
      <DayBar day={day} onChange={changeDay} />

      <div className="grid grid-cols-2 gap-3">
        {stats ? (
          <>
            <Stat label="Tổng thời gian" value={formatDuration(total)} />
            <Stat label="Số lần hoạt động" value={`${times} lần`} />
          </>
        ) : (
          <>
            <Skeleton className={`${SIZE.stat} rounded-2xl`} />
            <Skeleton className={`${SIZE.stat} rounded-2xl`} />
          </>
        )}
      </div>

      {stats && stats.length === 0 ? (
        // Chưa có dữ liệu: 1 khung thay cho cả biểu đồ và danh sách (cùng chiếm phần còn lại)
        <div className={`${TABLE_CLASS} flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center`}>
          <Icon3D emoji="📊" className="h-12 w-12" />
          <span className="text-sm leading-5 text-white/70">Chưa có hoạt động nào trong ngày này. Ghi lại ở Time line để xem thống kê.</span>
        </div>
      ) : (
        <>
          <GlassPanel className={CHART_CLASS}>
            {stats ? <Chart stats={stats} selected={selected} onSelect={toggle} /> : <ChartSkeleton />}
          </GlassPanel>
          {/* Bảng số liệu của biểu đồ: chạm 1 dòng để làm nổi cột tương ứng */}
          <ScrollArea className={TABLE_CLASS}>
            {stats ? (
              <div className="divide-y divide-white/10">
                {stats.map((s) => (
                  <StatRow key={s.key} stat={s} total={total} active={selected === s.key} onClick={() => toggle(s.key)} />
                ))}
              </div>
            ) : (
              <RowsSkeleton />
            )}
          </ScrollArea>
        </>
      )}
    </PageShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={STAT_CLASS}>
      <span className="truncate text-xs leading-4 text-white/60">{label}</span>
      <span className="truncate text-base leading-6 font-bold">{value}</span>
    </div>
  )
}

function Chart({ stats, selected, onSelect }: { stats: ActivityStat[]; selected: string | null; onSelect: (key: string) => void }) {
  const { top, ticks } = niceScale(Math.max(...stats.map((s) => s.minutes), 1))
  const current = stats.find((s) => s.key === selected)
  const pct = (m: number) => `${(m / top) * 100}%`

  return (
    <>
      {/* Tiêu đề; khi chọn 1 cột thì hiện chi tiết của cột đó */}
      <p className="flex h-5 items-center justify-between gap-2 text-sm leading-5">
        <span className="truncate font-semibold">{current ? current.name : 'Thời gian theo hoạt động'}</span>
        <span className="shrink-0 text-xs text-white/60">{current ? `${formatDuration(current.minutes)} · ${current.count} lần` : 'Chạm cột để xem'}</span>
      </p>

      {/* Vùng vẽ: chừa phía trên cho nhãn số của cột cao nhất */}
      <div className="flex min-h-0 flex-1 gap-2 pt-4">
        <div className={`${Y_AXIS} relative`}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 text-[10px] leading-3 text-white/50 tabular-nums"
              style={{ bottom: pct(t) }}
            >
              {compactDuration(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* Đường lưới mảnh, đường gốc đậm hơn một chút */}
          {ticks.map((t) => (
            <span key={t} className={`absolute inset-x-0 h-px ${t === 0 ? 'bg-white/30' : 'bg-white/10'}`} style={{ bottom: pct(t) }} />
          ))}
          <div className="relative flex h-full items-end gap-1">
            {stats.map((s) => {
              const dim = selected !== null && selected !== s.key
              const labeled = stats.length <= MAX_LABELED || selected === s.key
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onSelect(s.key)}
                  aria-label={`${s.name}: ${formatDuration(s.minutes)}`}
                  aria-pressed={selected === s.key}
                  className={`flex h-full min-w-0 flex-1 items-end justify-center transition-opacity ${dim ? 'opacity-35' : ''}`}
                >
                  {/* Cột: tối đa 24px, bo tròn đầu trên, gốc vuông; màu theo thẻ */}
                  <span
                    className={`relative w-full max-w-6 rounded-t bg-gradient-to-t ${s.color}`}
                    style={{ height: pct(s.minutes), minHeight: s.minutes > 0 ? 2 : 0 }}
                  >
                    {labeled && (
                      <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[10px] leading-3 font-semibold whitespace-nowrap">
                        {compactDuration(s.minutes)}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Trục ngang: icon của từng hoạt động, thẳng với cột */}
      <div className={`flex ${X_AXIS} gap-2`}>
        <div className={Y_AXIS} />
        <div className="flex flex-1 gap-1">
          {stats.map((s) => (
            <button
              key={s.key}
              type="button"
              tabIndex={-1}
              onClick={() => onSelect(s.key)}
              className={`flex min-w-0 flex-1 justify-center transition-opacity ${selected !== null && selected !== s.key ? 'opacity-35' : ''}`}
            >
              <CardIcon icon={s.icon} color={s.color} box="h-7 w-7" img="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function StatRow({ stat, total, active, onClick }: { stat: ActivityStat; total: number; active: boolean; onClick: () => void }) {
  const share = total ? Math.round((stat.minutes / total) * 100) : 0
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${ROW} flex w-full items-center gap-3 px-4 text-left transition ${active ? 'bg-white/15' : 'hover:bg-white/5'}`}
    >
      <CardIcon icon={stat.icon} color={stat.color} box="h-9 w-9" img="h-6 w-6" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-semibold">{stat.name}</span>
        <span className="flex items-center gap-1.5 truncate text-xs leading-4 text-white/60">
          {stat.count} lần · {share}%
          {stat.ongoing && (
            <span className="flex items-center gap-1 font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              Đang diễn ra
            </span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-sm leading-5 font-bold tabular-nums">{formatDuration(stat.minutes)}</span>
    </button>
  )
}

function ChartSkeleton() {
  return (
    <>
      <Skeleton className="h-5 w-44 rounded-md" />
      <div className="flex min-h-0 flex-1 gap-2 pt-4">
        <div className={Y_AXIS} />
        <div className="flex flex-1 items-end gap-1">
          {SKELETON_BARS.map((h, i) => (
            <div key={i} className="flex h-full flex-1 items-end justify-center">
              <Skeleton className={`w-6 rounded-t rounded-b-none ${h}`} />
            </div>
          ))}
        </div>
      </div>
      <div className={`flex ${X_AXIS} gap-2`}>
        <div className={Y_AXIS} />
        <div className="flex flex-1 gap-1">
          {SKELETON_BARS.map((_, i) => (
            <div key={i} className="flex flex-1 justify-center">
              <Skeleton className="h-7 w-7 rounded-[22%]" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function RowsSkeleton() {
  return (
    <div className="divide-y divide-white/10">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} className={`${ROW} flex items-center gap-3 px-4`}>
          <Skeleton className="h-9 w-9 rounded-[22%]" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
      ))}
    </div>
  )
}

export function StatsPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <DayBarSkeleton />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
      </div>
      <GlassPanel className={CHART_CLASS}>
        <ChartSkeleton />
      </GlassPanel>
      <ScrollArea className={`${TABLE_CLASS} !overflow-hidden`}>
        <RowsSkeleton />
      </ScrollArea>
    </PageShell>
  )
}
