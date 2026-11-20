import { useState } from 'react'
import { byRank, potImage, potKindById, potSetById, RANK_STYLE, type OwnedPot, type Rank } from '../data/pots'
import { DragScroll } from './DragScroll'
import { potCard, tierInfo } from './potInfo'

// Giao diện đặt / dời / cất chậu trong game (xem CLAUDE.md "Đặt chậu"): danh sách chậu cuộn ngang ở đáy,
// bảng thông tin hiệu ứng bên phải (thu gọn được, cuộn dọc), menu khi nhấn giữ chậu đã đặt.

export const LIST_H = 132 // chiều cao vùng danh sách (px)
export const BTN =
  'flex h-10 items-center justify-center border border-white/30 bg-gradient-to-br from-fuchsia-500/60 to-indigo-500/70 px-3 text-sm font-semibold shadow-lg shadow-black/30 backdrop-blur-xl transition active:scale-95 disabled:opacity-40'

// Huy hiệu hạng: màu (B xanh biển, A tím, S vàng cam) + chữ nhỏ cho người khó phân biệt màu
export function RankBadge({ rank, className = '' }: { rank: Rank; className?: string }) {
  return (
    <span className={`flex h-4 w-4 items-center justify-center bg-gradient-to-br text-[10px] leading-none font-bold text-white shadow shadow-black/40 ${RANK_STYLE[rank]} ${className}`}>
      {rank}
    </span>
  )
}

// ---- Cột lọc hạng ở đầu (bên trái) dải danh sách cuộn ngang (chọn hạt / chọn chậu): S, A, B, ALL xếp dọc, ĐỨNG YÊN khi cuộn danh sách ----
export type RankFilterValue = Rank | 'ALL'
const FILTERS: RankFilterValue[] = ['S', 'A', 'B', 'ALL']
export function RankFilter({ value, onChange }: { value: RankFilterValue; onChange: (v: RankFilterValue) => void }) {
  return (
    <div className="flex w-14 shrink-0 flex-col gap-1" role="radiogroup" aria-label="Lọc theo hạng">
      {FILTERS.map((f) => {
        const on = f === value
        return (
          <button key={f} type="button" role="radio" aria-checked={on} onClick={() => onChange(f)}
            className={`flex min-h-0 flex-1 items-center justify-center border text-xs font-bold transition active:scale-95 ${
              on ? (f === 'ALL' ? 'border-white/80 bg-white/30' : `border-white/80 bg-gradient-to-br ${RANK_STYLE[f]}`) : 'border-white/15 bg-white/5 text-white/70'
            }`}>
            {f}
          </button>
        )
      })}
    </div>
  )
}

// ---- Danh sách chậu trong kho (cuộn ngang) ----
export function PotList({ pots, onTier, tier, selected, onSelect }: {
  pots: OwnedPot[] // chậu trong kho (chưa đặt)
  onTier: OwnedPot[]
  tier: number
  selected: string | null
  onSelect: (id: string) => void
}) {
  const [filter, setFilter] = useState<RankFilterValue>('ALL') // mở danh sách: mặc định ALL
  const rankOf = (p: OwnedPot) => potSetById.get(potKindById.get(p.kind)?.set ?? '')?.rank ?? 'B'
  const shown = byRank(pots, rankOf).filter((p) => filter === 'ALL' || rankOf(p) === filter)
  return (
    <div
      className="absolute bottom-0 z-30 flex gap-2 border-t border-white/20 bg-indigo-950/55 pt-2 pb-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
      style={{ height: LIST_H, left: 0, right: 0, paddingLeft: 'calc(var(--safe-l) + 10px)', paddingRight: 'calc(var(--safe-r) + 10px)' }}
    >
      {pots.length > 0 && <RankFilter value={filter} onChange={setFilter} />}
      {shown.length === 0 ? (
        <p className="flex h-full min-w-0 flex-1 items-center justify-center px-6 text-center text-sm text-white/75">
          {pots.length === 0 ? 'Kho không còn chậu nào. Cất bớt chậu ở chỗ khác, hoặc chờ tính năng nhận chậu mới (sắp có).' : `Không có chậu hạng ${filter} trong kho.`}
        </p>
      ) : (
        <DragScroll key={filter} axis="x" className="h-full min-w-0 flex-1">
          {shown.map((p) => {
            const c = potCard(onTier, p, tier)
            const on = p.id === selected
            return (
              <button
                key={p.id}
                type="button"
                disabled={!!c.block}
                onClick={() => onSelect(p.id)}
                className={`relative mr-2 flex h-[112px] w-[104px] shrink-0 flex-col items-center border px-1 pt-1 text-center transition active:scale-95 ${
                  c.block ? 'border-white/10 bg-white/5 opacity-45' : on ? 'border-amber-200 bg-white/25' : c.change ? 'border-amber-300/80 bg-white/10 shadow-[0_0_14px_rgba(253,230,138,0.55)]' : 'border-white/20 bg-white/10'
                }`}
              >
                <RankBadge rank={c.set.rank} className="absolute top-1 left-1" />
                <span className="absolute top-1 right-1 text-[10px] leading-4 text-white/80">Cấp {p.level}</span>
                <img src={potImage(p.kind, p.level)} alt="" draggable={false} className="h-12 w-12 object-contain" />
                <span className="mt-0.5 text-[11px] leading-[13px] font-semibold">{c.kind.name}</span>
                <span className="text-[10px] leading-3 text-white/70">{c.progress}</span>
                {c.change && <span className="mt-0.5 text-[10px] leading-3 font-semibold text-amber-200">{c.change}</span>}
                {c.block && <span className="mt-0.5 text-[10px] leading-3 font-semibold text-sky-200">{c.block}</span>}
              </button>
            )
          })}
        </DragScroll>
      )}
    </div>
  )
}

// ---- Bảng thông tin hiệu ứng (phía trên danh sách, bên phải) ----
export function InfoPanel({ onTier, sel }: { onTier: OwnedPot[]; sel: OwnedPot | null }) {
  const [open, setOpen] = useState(true)
  const info = tierInfo(onTier, sel)
  return (
    <div
      className="absolute z-30 flex w-60 flex-col border border-white/25 bg-indigo-950/60 shadow-2xl shadow-black/50 backdrop-blur-xl"
      style={{ right: 'calc(var(--safe-r) + 10px)', top: 10, maxHeight: `calc(100% - ${LIST_H + 20}px)` }}
    >
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-9 shrink-0 items-center justify-between px-3 text-left text-sm font-semibold">
        <span className="truncate">{open ? 'Hiệu ứng bộ chậu' : info.summary}</span>
        <span className="ml-2 text-white/70">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <DragScroll axis="y" className="min-h-0 flex-1 border-t border-white/15">
          <div className="space-y-1 px-3 py-2 text-xs leading-[18px]">
            {info.head && <p className="font-semibold text-amber-200">{info.head}</p>}
            {info.lines.map((l, i) => (
              <p key={i} className={l.state === 'done' ? 'text-emerald-200' : l.state === 'next' ? 'font-semibold text-white' : 'text-white/45'}>
                {l.text}
              </p>
            ))}
          </div>
        </DragScroll>
      )}
    </div>
  )
}

// ---- Menu khi nhấn giữ chậu đã đặt: Dời chỗ / Cất vào kho ----
export function PotMenu({ pot, confirm, busy, onMove, onStore, onUpgrade, onClose }: {
  pot: OwnedPot
  confirm: boolean // đã bấm "Cất" 1 lần (chậu có cây)
  busy: boolean
  onMove: () => void
  onStore: () => void
  onUpgrade: () => void // mở màn hình đập chậu
  onClose: () => void
}) {
  const kind = potKindById.get(pot.kind)
  const set = kind && potSetById.get(kind.set)
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35" onClick={onClose}>
      <div className="w-80 border border-white/25 bg-indigo-950/80 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <img src={potImage(pot.kind, pot.level)} alt="" className="h-14 w-14 object-contain" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-base leading-6 font-semibold">
              {set && <RankBadge rank={set.rank} />}
              {kind?.name ?? 'Chậu'}
            </p>
            <p className="text-xs leading-5 text-white/70">Bộ {set?.name} · Cấp {pot.level}</p>
          </div>
        </div>
        {confirm && <p className="mb-2 text-sm leading-5 font-semibold text-rose-200">Cất chậu? Cây đang trồng sẽ mất</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`${BTN} from-slate-400/40 to-slate-600/50`} onClick={onClose}>Đóng</button>
          <button type="button" className={`${BTN} from-amber-400/70 to-fuchsia-600/70`} disabled={busy} onClick={onUpgrade}>Đập</button>
          <button type="button" className={BTN} disabled={busy} onClick={onMove}>Dời chỗ</button>
          <button type="button" className={`${BTN} ${confirm ? 'from-rose-500/80 to-red-700/80' : ''}`} disabled={busy} onClick={onStore}>
            {confirm ? 'Cất luôn' : 'Cất vào kho'}
          </button>
        </div>
      </div>
    </div>
  )
}
