import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import { NEWS_MAX, type ChangelogEntry } from '../data/changelog'
import { DragScroll } from './DragScroll'
import { BTN } from './PotUi'
import { GLASS_ROUND } from './glass'

// Màn hình "Có gì mới" (xem CLAUDE.md): tự mở sau màn hình tải khi có bản cập nhật chưa xem; xem lại ở Cẩm nang → Cập nhật.

const dateText = (v: string) => { const [y, m, d] = v.split('.')[0].split('-'); return d ? `${d}/${m}/${y}` : v }

// Danh sách các bản (dùng chung cho popup và Cẩm nang)
export function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <div className="space-y-3 px-4 py-3">
      {entries.map((e) => (
        <div key={e.version}>
          <p className="text-sm leading-5 font-semibold text-amber-200">{e.title}</p>
          <p className="text-[11px] leading-4 text-white/55">Bản cập nhật {dateText(e.version)}</p>
          {e.image && <img src={e.image} alt="" className="mt-1.5 max-h-40 w-auto object-contain" />}
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm leading-5 text-white/85">
            {e.items.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function NewsScreen({ entries, onClose }: { entries: ChangelogEntry[]; onClose: () => void }) {
  const shown = entries.slice(0, NEWS_MAX)
  const more = entries.length - shown.length
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55">
      <div className="flex h-[calc(100%-24px)] w-[min(620px,calc(100%-24px))] flex-col border border-amber-200/40 bg-gradient-to-br from-[#160d3a]/95 via-[#26124f]/95 to-[#3b1450]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/15 pr-2 pl-4">
          <Icon3D emoji="✨" className="h-7 w-7 text-amber-200" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg leading-6 font-light lowercase">có gì mới</p>
            <p className="truncate text-xs leading-4 text-white/65">Vườn mây vừa được cập nhật</p>
          </div>
          <button type="button" data-round aria-label="Đóng" onClick={onClose}
            className={`${GLASS_ROUND} h-10 w-10`}>
            <LineIcon icon="cancel" className="h-5 w-5" />
          </button>
        </div>
        <DragScroll axis="y" className="min-h-0 flex-1">
          <ChangelogList entries={shown} />
          {more > 0 && <p className="px-4 pb-3 text-xs text-white/55">… và {more} bản cập nhật cũ hơn (xem ở Cẩm nang → Cập nhật).</p>}
        </DragScroll>
        <div className="flex h-14 shrink-0 items-center justify-end border-t border-white/10 px-4">
          <button type="button" onClick={onClose} className={`${BTN} w-40 from-amber-400/80 to-rose-500/80`}>Đã hiểu</button>
        </div>
      </div>
    </div>
  )
}
