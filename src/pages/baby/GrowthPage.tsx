import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { LinkButton } from '../../components/ui/Button'
import { FAB_SPACE, Fab, FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { LIST_CARD, LIST_CARDS_GAP, LIST_CARDS_SCROLL } from '../../components/ui/listStyle'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { ChildPicker, ChildPickerSkeleton } from './components'
import { useBaby } from './data/BabyContext'
import { dateOf, formatMeasure, useChildGrowth, type GrowthRecord } from './data/growth'
import { childAge, type Child } from './data/types'

// Màn hình Phát triển (/baby/growth): các thẻ chiều cao / cân nặng / vắc xin theo ngày của CON ĐANG CHỌN (chọn con trên thanh tiêu đề, giống Time line).
// FAB phễu: chạm để chỉ xem các lần tiêm vắc xin, chạm lần nữa để xem lại toàn bộ.

const LIST_CLASS = `${LIST_CARDS_SCROLL} ${LIST_CARDS_GAP} ${FAB_SPACE}`
const ROW = `${SIZE.listItem} flex items-center gap-3 px-4 transition active:scale-[0.98]`
const DATE_BOX = 'flex w-14 shrink-0 flex-col items-center border-r border-white/15 pr-3'

// Tuổi của con vào ngày ghi (vd "8 tháng 12 ngày"); ngày ghi trước ngày sinh thì bỏ trống
function ageAt(child: Child | null, date: string) {
  if (!child?.birthDate) return ''
  const at = dateOf(date)
  return at < dateOf(child.birthDate) ? '' : childAge(child.birthDate, at)
}

function measures(r: GrowthRecord) {
  const parts = [r.height !== null && `Cao ${formatMeasure(r.height)} cm`, r.weight !== null && `Nặng ${formatMeasure(r.weight)} kg`].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Không đo'
}

function GrowthRow({ record, child }: { record: GrowthRecord; child: Child | null }) {
  const at = dateOf(record.date)
  const age = ageAt(child, record.date)
  return (
    <Link to={`/baby/growth/${record.id}`} className={`${LIST_CARD} ${ROW}`}>
      <span className={DATE_BOX}>
        <span className="text-lg leading-6 font-bold tabular-nums">
          {String(at.getDate()).padStart(2, '0')}/{String(at.getMonth() + 1).padStart(2, '0')}
        </span>
        <span className="text-xs leading-4 text-white/60 tabular-nums">{at.getFullYear()}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-semibold">{measures(record)}</span>
        <span className="block h-4 truncate text-xs leading-4 text-white/60">{age}</span>
        {record.vaccine ? (
          <span className="flex h-5 items-center gap-1.5 text-xs leading-5 font-semibold text-fuchsia-200">
            <Icon3D emoji="💉" className="h-4 w-4" />
            <span className="truncate">{record.vaccine}</span>
          </span>
        ) : (
          <span className="block h-5 truncate text-xs leading-5 text-white/40">Không tiêm vắc xin</span>
        )}
      </span>
    </Link>
  )
}

export function GrowthPage() {
  const { loading, child } = useBaby()
  const records = useChildGrowth()
  // Lọc: chỉ xem các lần tiêm vắc xin
  const [onlyVaccine, setOnlyVaccine] = useState(false)
  if (loading || !records) return <GrowthPageSkeleton />

  const vaccines = records.filter((r) => r.vaccine)
  const shown = onlyVaccine ? vaccines : records
  const subtitle = !child
    ? 'Chưa có con nào'
    : onlyVaccine
      ? `Chỉ xem tiêm vắc xin · ${vaccines.length} lần`
      : `${records.length} lần ghi · ${vaccines.length} lần tiêm vắc xin`

  return (
    <PageShell>
      <AppHeader title="Phát triển" subtitle={subtitle} backTo="/baby" right={child ? <ChildPicker /> : undefined} />
      {!child ? (
        <GlassPanel className="space-y-4 text-center">
          <div className="flex h-12 justify-center">
            <Icon3D emoji="📏" className="h-12 w-12" />
          </div>
          <p className="text-sm leading-5 text-white/70">Thông tin phát triển đi theo từng con. Hãy thêm con trước.</p>
          <LinkButton to="/baby/children/new" variant="primary">
            Thêm con
          </LinkButton>
        </GlassPanel>
      ) : (
        <ScrollArea className={LIST_CLASS}>
          {shown.length === 0 ? (
            <GlassPanel className="space-y-4 text-center">
              <div className="flex h-12 justify-center">
                <Icon3D emoji={onlyVaccine ? '💉' : '📏'} className="h-12 w-12" />
              </div>
              <p className="text-sm leading-5 text-white/70">
                {onlyVaccine
                  ? 'Chưa có lần tiêm vắc xin nào. Chạm nút phễu để xem lại toàn bộ.'
                  : 'Chưa có thẻ nào. Bấm nút dấu cộng ở góc dưới để ghi ngày, chiều cao, cân nặng và vắc xin.'}
              </p>
            </GlassPanel>
          ) : (
            shown.map((r) => <GrowthRow key={r.id} record={r} child={child} />)
          )}
        </ScrollArea>
      )}
      {child && (
        <FabGroup>
          <Fab
            icon="filter"
            variant="secondary"
            label={onlyVaccine ? 'Xem toàn bộ thông tin' : 'Chỉ xem tiêm vắc xin'}
            aria-pressed={onlyVaccine}
            onClick={() => setOnlyVaccine((v) => !v)}
            className={onlyVaccine ? 'ring-4 ring-sky-300/70' : ''}
          />
          <FabLink to="/baby/growth/new" icon="add" label="Thêm thẻ phát triển" />
        </FabGroup>
      )}
    </PageShell>
  )
}

export function GrowthPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton subtitle right={<ChildPickerSkeleton />} />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className={`${SIZE.listItem} w-full`} />
        ))}
      </ScrollArea>
      <FabSkeleton count={2} />
    </PageShell>
  )
}
