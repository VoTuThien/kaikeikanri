import { Link } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { LinkButton } from '../../components/ui/Button'
import { FAB_SPACE, FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { LIST_CARD, LIST_CARDS_GAP, LIST_CARDS_SCROLL } from '../../components/ui/listStyle'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { ChildPicker, ChildPickerSkeleton } from './components'
import { useBaby } from './data/BabyContext'
import { TRIAL_DAYS, trialInfo, useChildFoods, type BabyFood } from './data/foods'
import { dateOf } from './data/growth'

// Ăn dặm — Thực phẩm đã thử (/baby/foods) của CON ĐANG CHỌN (chọn con trên thanh tiêu đề, giống Time line):
// mỗi thực phẩm 1 thẻ: đang thử (ngày n/3) / ăn được / có phản ứng (đỏ, kèm ghi chú), đánh dấu nhóm dễ dị ứng.
// Quy tắc thử món mới 3 ngày: đang có món trong 3 ngày theo dõi thì khung nhắc trên đầu "chưa nên thêm món mới tới …".
// Món mới ghi trong bữa ăn dặm ở Time line tự được thêm vào đây (đang thử).

const LIST_CLASS = `${LIST_CARDS_SCROLL} ${LIST_CARDS_GAP} ${FAB_SPACE}`
const ROW = `${SIZE.listItem} flex items-center gap-3 px-4 transition active:scale-[0.98]`
const BANNER = 'flex items-center gap-3 !p-3'

const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

function statusLine(f: BabyFood): { text: string; className: string } {
  if (f.status === 'reaction') return { text: `Có phản ứng${f.reaction ? `: ${f.reaction}` : ''}`, className: 'text-rose-200 font-semibold' }
  if (f.status === 'ok') return { text: `Ăn được${f.firstTried ? ` · thử từ ${dm(dateOf(f.firstTried))}` : ''}`, className: 'text-emerald-200' }
  const t = trialInfo(f)
  if (!t) return { text: 'Đang thử · chưa ghi ngày thử', className: 'text-amber-100' }
  return t.due
    ? { text: `Đã đủ ${TRIAL_DAYS} ngày · chạm để cập nhật kết quả`, className: 'text-amber-100 font-semibold' }
    : { text: `Đang thử · ngày ${t.day}/${TRIAL_DAYS}`, className: 'text-amber-100' }
}

function FoodRow({ food }: { food: BabyFood }) {
  const s = statusLine(food)
  return (
    <Link
      to={`/baby/foods/${food.id}`}
      className={`${LIST_CARD} ${ROW} ${food.status === 'reaction' ? 'border-rose-300/60 bg-rose-500/15' : ''}`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base leading-6 font-semibold">{food.name}</span>
          {food.allergen && (
            <span className="shrink-0 border border-amber-200/50 bg-amber-400/20 px-1.5 text-[10px] leading-4 font-semibold text-amber-100">Dễ dị ứng</span>
          )}
        </span>
        <span className="block truncate text-xs leading-4 text-white/55">{food.group}</span>
        <span className={`block truncate text-xs leading-5 ${s.className}`}>{s.text}</span>
      </span>
      <span className="shrink-0 text-xl leading-none text-white/40" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}

export function FoodsPage() {
  const { loading, child } = useBaby()
  const foods = useChildFoods()
  if (loading || !foods) return <FoodsPageSkeleton />

  const reactions = foods.filter((f) => f.status === 'reaction').length
  const okCount = foods.filter((f) => f.status === 'ok').length
  // Món đang trong 3 ngày theo dõi (quy tắc thử món mới)
  const trials = foods.map((f) => ({ f, t: trialInfo(f) })).filter((x) => x.t && !x.t.due)
  const due = foods.filter((f) => trialInfo(f)?.due)
  const subtitle = !child ? 'Chưa có con nào' : `${foods.length} thực phẩm · ${okCount} ăn được${reactions ? ` · ${reactions} có phản ứng` : ''}`

  return (
    <PageShell>
      <AppHeader title="Thực phẩm" subtitle={subtitle} backTo="/baby" right={child ? <ChildPicker /> : undefined} />
      {!child ? (
        <GlassPanel className="space-y-4 text-center">
          <div className="flex h-12 justify-center">
            <Icon3D emoji="🥕" className="h-12 w-12" />
          </div>
          <p className="text-sm leading-5 text-white/70">Danh sách thực phẩm đi theo từng con. Hãy thêm con trước.</p>
          <LinkButton to="/baby/children/new" variant="primary">
            Thêm con
          </LinkButton>
        </GlassPanel>
      ) : (
        <>
          {/* Nhắc quy tắc thử món mới 3 ngày */}
          {(trials.length > 0 || due.length > 0) && (
            <GlassPanel className={BANNER}>
              <Icon3D emoji="🕒" className="h-8 w-8" />
              <p className="min-w-0 flex-1 text-xs leading-4 text-amber-100">
                {trials.length > 0
                  ? `Đang theo dõi ${trials.map((x) => `${x.f.name} (ngày ${x.t!.day}/${TRIAL_DAYS})`).join(', ')}. Chưa nên cho thử món mới tới hết ${dm(
                      new Date(Math.max(...trials.map((x) => x.t!.until.getTime()))),
                    )}.`
                  : `${due.map((f) => f.name).join(', ')} đã đủ ${TRIAL_DAYS} ngày theo dõi. Chạm vào để ghi kết quả: ăn được hay có phản ứng.`}
              </p>
            </GlassPanel>
          )}
          <ScrollArea className={LIST_CLASS}>
            {foods.length === 0 ? (
              <GlassPanel className="space-y-4 text-center">
                <div className="flex h-12 justify-center">
                  <Icon3D emoji="🥕" className="h-12 w-12" />
                </div>
                <p className="text-sm leading-5 text-white/70">
                  Chưa có thực phẩm nào. Bấm dấu cộng để thêm, hoặc ghi bữa ăn dặm ở Time line, món mới sẽ tự được thêm vào đây.
                </p>
              </GlassPanel>
            ) : (
              foods.map((f) => <FoodRow key={f.id} food={f} />)
            )}
          </ScrollArea>
          <FabGroup>
            <FabLink to="/baby/foods/new" icon="add" label="Thêm thực phẩm" />
          </FabGroup>
        </>
      )}
    </PageShell>
  )
}

export function FoodsPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton subtitle right={<ChildPickerSkeleton />} />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className={`${SIZE.listItem} w-full`} />
        ))}
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
