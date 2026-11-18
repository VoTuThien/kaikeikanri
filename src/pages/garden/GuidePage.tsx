import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { GLASS_CLASS } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { LIST_HEADER, LIST_ROW_BG } from '../../components/ui/listStyle'
import { SIZE } from '../../components/ui/sizes'
import { CropBlock } from './components'
import { CROPS, formatGrow, levelOf } from './data/crops'
import { useGarden } from './data/GardenContext'

// Cẩm nang: cách chơi + bảng các loại cây (cấp mở khoá, giá hạt, thời gian lớn, thu được, lãi)
const RULES = [
  'Chạm ô đất trống để mua hạt và gieo. Cây lớn theo thời gian thật, đóng app cây vẫn lớn.',
  'Tưới nước (huy hiệu giọt nước) trước khi chín: thu thêm 1 nông sản.',
  'Khoảng 1/3 số cây bị sâu khi lớn được nửa chừng: không bắt sâu thì bớt 1 nông sản.',
  'Thu hoạch được kinh nghiệm để lên cấp, mở khoá cây mới. Bán nông sản trong Kho lấy xu để mở thêm ô đất.',
]

export function GuidePage() {
  const { loading, garden } = useGarden()
  if (loading || !garden) return <GuidePageSkeleton />
  const level = levelOf(garden.xp)

  return (
    <PageShell>
      <AppHeader title="Cẩm nang" backTo="/garden" subtitle={`Bạn đang ở cấp ${level}`} />
      <ScrollArea className={`${GLASS_CLASS} !p-0`}>
        <p className={`${LIST_HEADER} px-4`}>Cách chơi</p>
        <ul className="list-disc space-y-1 py-3 pr-4 pl-8 text-sm leading-5 text-white/80">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className={`${LIST_HEADER} px-4`}>Các loại cây</p>
        <ul className="divide-y divide-white/10">
          {CROPS.map((c) => {
            const profit = c.yield * c.sellPrice - c.seedPrice
            return (
              <li key={c.id} className={`${SIZE.row} ${LIST_ROW_BG} flex items-center gap-3 px-4 ${level < c.level ? 'opacity-50' : ''}`}>
                <CropBlock icon={c.icon} color={c.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold">
                    {c.name} <span className="font-normal text-white/60">· cấp {c.level}</span>
                  </span>
                  <span className="block truncate text-xs leading-4 text-white/70">
                    Hạt {c.seedPrice} xu · lớn {formatGrow(c.minutes)} · thu {c.yield} × {c.sellPrice} xu
                  </span>
                </span>
                <span className="w-16 shrink-0 text-right text-sm leading-5 font-semibold text-lime-200">+{profit} xu</span>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </PageShell>
  )
}

export function GuidePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton subtitle />
      <ScrollArea className={`${GLASS_CLASS} !p-0`}>
        <div className={`${SIZE.stickyHeader} bg-white/10`} />
        <div className="space-y-2 px-4 py-3">
          {RULES.map((r) => (
            <Skeleton key={r} className="h-9 w-full" />
          ))}
        </div>
      </ScrollArea>
    </PageShell>
  )
}
