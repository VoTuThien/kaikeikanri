import { lazy, Suspense, useMemo, useState } from 'react'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import { useGarden } from '../data/GardenContext'
import { buyRolls, errorText, grantTestRolls, pullPots, type Garden } from '../data/api'
import { CROPS } from '../data/crops'
import {
  bannerOf,
  HARD_PITY,
  insectById,
  itemName,
  rateRows,
  ROLL_PRICE,
  SOFT_PITY,
  TEST_GRANT,
  TESTER_UIDS,
  type PullItem,
  type Rarity,
} from '../data/gacha'
import { potImage, potKindById, potSetById } from '../data/pots'
import { DragScroll } from './DragScroll'
import { BTN, RankBadge } from './PotUi'

// Màn hình gacha trong game (xem CLAUDE.md "Gacha"): banner chậu (Vọng Tinh). Bấm quay → ghi Firestore → hiệu ứng mở cục roll
// (RollReveal) → hiện từng món (chạm để sang món tiếp) → bảng tổng kết.

const RollReveal = lazy(() => import('./RollReveal').then((m) => ({ default: m.RollReveal })))

export const ROLL_IMG = { vong_tinh: '/game/roll/vong_tinh.webp', sao_duyen: '/game/roll/sao_duyen.webp' }
export const STONE_IMG = '/game/tien/da_vu_tru.webp'
export const FEATHER_IMG = '/game/tien/long_chim.webp' // lông chim: tiền mua hạt / bán nông sản

const GLOW: Record<Rarity, string> = {
  gold: 'border-amber-200/90 bg-gradient-to-b from-amber-300/35 to-orange-600/25 shadow-[0_0_22px_rgba(253,211,77,0.55)]',
  purple: 'border-violet-300/80 bg-gradient-to-b from-violet-400/30 to-purple-800/25 shadow-[0_0_18px_rgba(196,148,255,0.45)]',
  blue: 'border-sky-300/50 bg-gradient-to-b from-sky-400/20 to-blue-800/20',
}

// Ảnh / icon của 1 món
function ItemArt({ item, className }: { item: PullItem; className: string }) {
  if (item.type === 'pot') return <img src={potImage(item.kind, 1)} alt="" draggable={false} className={`${className} object-contain`} />
  const icon = item.type === 'seed' ? CROPS.find((c) => c.id === item.crop)?.icon ?? '🌱' : insectById.get(item.insect)?.icon ?? '🐛'
  return <Icon3D emoji={icon} className={className} />
}
function itemTag(item: PullItem) {
  if (item.type !== 'pot') return item.type === 'seed' ? 'Hạt giống' : 'Côn trùng'
  if (item.isNew) return 'MỚI!'
  return 'Trùng'
}
function ItemCard({ item, big = false }: { item: PullItem; big?: boolean }) {
  const set = item.type === 'pot' ? potSetById.get(potKindById.get(item.kind)?.set ?? '') : undefined
  return (
    <div className={`relative flex flex-col items-center border text-center ${GLOW[item.rarity]} ${big ? 'w-64 px-4 pt-4 pb-4' : 'h-full w-full px-1 pt-1.5 pb-1'}`}>
      {set && <RankBadge rank={set.rank} className="absolute top-1.5 left-1.5" />}
      <span className={`absolute top-1 right-1.5 font-semibold ${big ? 'text-xs' : 'text-[10px]'} ${item.type === 'pot' && item.isNew ? 'text-amber-200' : 'text-white/70'}`}>
        {itemTag(item)}
      </span>
      <ItemArt item={item} className={big ? 'mt-2 h-32 w-32' : 'mt-2 h-12 w-12'} />
      <span className={`font-semibold ${big ? 'mt-3 text-lg leading-6' : 'mt-1 text-[11px] leading-[13px]'}`}>{itemName(item)}</span>
      {set && <span className={`text-white/70 ${big ? 'text-sm leading-5' : 'text-[10px] leading-3'}`}>Bộ {set.name}</span>}
      {big && item.type === 'pot' && item.off && <span className="mt-1 text-xs text-white/60">Lần vàng tới chắc chắn là chậu mới của banner</span>}
    </div>
  )
}

// Ô số lượng (cục roll / đá) trên thanh trên cùng
function Count({ img, n, label }: { img: string; n: number; label: string }) {
  return (
    <div className="flex h-9 items-center gap-1.5 border border-white/20 bg-black/30 pr-3 pl-1.5 backdrop-blur-md" aria-label={label}>
      <img src={img} alt="" className="h-7 w-7 object-contain" />
      <span className="text-sm font-bold tabular-nums">{n.toLocaleString('vi-VN')}</span>
    </div>
  )
}

type View =
  | { kind: 'banner'; panel: null | 'rates' | 'history' }
  | { kind: 'reveal'; items: PullItem[]; count: 1 | 10 }
  | { kind: 'one'; items: PullItem[]; i: number; count: 1 | 10 }
  | { kind: 'sum'; items: PullItem[]; count: 1 | 10 }

export function GachaScreen({ onClose }: { onClose: () => void }) {
  const { garden, actor } = useGarden()
  const [view, setView] = useState<View>({ kind: 'banner', panel: null })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const banner = bannerOf()
  const set = potSetById.get(banner.setId)!
  const g = garden as Garden

  async function job(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      if (ok) setMsg(ok)
    } catch (err) {
      setMsg(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  async function pull(count: 1 | 10) {
    if (busy) return
    if (g.rolls.vong_tinh < count) {
      setMsg(`Cần ${count} Vọng Tinh — đổi thêm bằng đá vũ trụ`)
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const items = await pullPots(actor, count) // ghi Firestore xong mới phát hiệu ứng
      setView({ kind: 'reveal', items, count })
    } catch (err) {
      setMsg(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const rarities = useMemo(() => (view.kind === 'reveal' ? view.items.map((i) => i.rarity) : []), [view])
  if (!garden) return null
  const toGold = HARD_PITY - g.gacha.sinceGold

  if (view.kind === 'reveal')
    return (
      <Suspense fallback={<div className="absolute inset-0 z-50 bg-black" />}>
        <RollReveal kind="vong_tinh" items={rarities} onDone={() => setView({ kind: 'one', items: view.items, i: 0, count: view.count })} />
      </Suspense>
    )

  if (view.kind === 'one') {
    const it = view.items[view.i]
    const next = () => (view.i + 1 < view.items.length ? setView({ ...view, i: view.i + 1 }) : setView({ kind: 'sum', items: view.items, count: view.count }))
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#0a0620] to-[#1c0f3d]" onClick={next}>
        <div key={view.i} className="animate-[gacha-pop_0.45s_ease-out]">
          <ItemCard item={it} big />
        </div>
        <p className="absolute bottom-4 text-xs tracking-[0.2em] text-white/60">
          {view.i + 1}/{view.items.length} · CHẠM ĐỂ TIẾP
        </p>
        {view.items.length > 1 && (
          <button
            type="button"
            className="absolute top-3 border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85 backdrop-blur"
            style={{ right: 'calc(var(--safe-r) + 12px)' }}
            onClick={(e) => {
              e.stopPropagation()
              setView({ kind: 'sum', items: view.items, count: view.count })
            }}
          >
            Bỏ qua ›
          </button>
        )}
      </div>
    )
  }

  if (view.kind === 'sum')
    return (
      <div className="absolute inset-0 z-50 flex flex-col bg-gradient-to-b from-[#0a0620] to-[#1c0f3d] pt-3 pb-3" style={{ paddingLeft: 'calc(var(--safe-l) + 14px)', paddingRight: 'calc(var(--safe-r) + 14px)' }}>
        <p className="mb-2 text-center text-sm font-semibold tracking-wide text-white/85">Kết quả {view.items.length} lần quay</p>
        <div className={`grid min-h-0 flex-1 gap-2 ${view.items.length > 1 ? 'grid-cols-5 grid-rows-2' : 'grid-cols-1 place-items-center'}`}>
          {[...view.items]
            .sort((a, b) => ({ gold: 0, purple: 1, blue: 2 })[a.rarity] - ({ gold: 0, purple: 1, blue: 2 })[b.rarity])
            .map((it, i) => (
              <div key={i} className={view.items.length > 1 ? 'min-h-0' : 'h-40 w-36'}>
                <ItemCard item={it} />
              </div>
            ))}
        </div>
        <div className="mx-auto mt-3 grid w-[22rem] grid-cols-2 gap-3">
          <button type="button" className={`${BTN} from-slate-400/40 to-slate-600/50`} onClick={() => setView({ kind: 'banner', panel: null })}>
            Xong
          </button>
          <button type="button" className={BTN} disabled={busy} onClick={() => void pull(view.count)}>
            Quay tiếp ×{view.count}
          </button>
        </div>
      </div>
    )

  // ---- Màn hình banner ----
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-br from-[#120a33]/95 via-[#24104d]/95 to-[#3b1450]/95 backdrop-blur-xl">
      {/* thanh trên: đóng, tên, số cục roll + đá */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/15" style={{ paddingLeft: 'calc(var(--safe-l) + 12px)', paddingRight: 'calc(var(--safe-r) + 12px)' }}>
        <button type="button" data-round aria-label="Đóng gacha" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10">
          <LineIcon icon="cancel" className="h-5 w-5" />
        </button>
        <p className="ml-1 text-lg font-light lowercase">ước nguyện</p>
        <div className="ml-auto flex gap-2">
          <Count img={ROLL_IMG.vong_tinh} n={g.rolls.vong_tinh} label="Vọng Tinh" />
          <Count img={ROLL_IMG.sao_duyen} n={g.rolls.sao_duyen} label="Sao Duyên" />
          <Count img={STONE_IMG} n={g.stones} label="Đá vũ trụ" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 py-3" style={{ paddingLeft: 'calc(var(--safe-l) + 12px)', paddingRight: 'calc(var(--safe-r) + 12px)' }}>
        {/* banner */}
        <div className="relative flex min-w-0 flex-1 flex-col border border-amber-200/40 bg-gradient-to-br from-orange-500/20 via-rose-700/15 to-indigo-900/30 p-3 shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-xl leading-7 font-semibold">
                <RankBadge rank="S" /> {set.name}
              </p>
              <p className="text-xs leading-5 text-white/70">Banner chậu · tháng {banner.month} · đổi banner ngày {banner.end.getDate()}/{banner.end.getMonth() + 1}</p>
            </div>
            <div className="flex gap-1">
              <button type="button" className={`${BTN} h-8 px-2 text-xs`} onClick={() => setView({ kind: 'banner', panel: 'rates' })}>Tỉ lệ</button>
              <button type="button" className={`${BTN} h-8 px-2 text-xs`} onClick={() => setView({ kind: 'banner', panel: 'history' })}>Lịch sử</button>
            </div>
          </div>
          <div className="mt-1 grid min-h-0 flex-1 grid-cols-6 items-end gap-1">
            {set.kinds.map((k) => (
              <div key={k} className="flex h-full min-h-0 min-w-0 flex-col items-center justify-end">
                <img src={potImage(k, 6)} alt="" draggable={false} className="min-h-0 w-full flex-1 object-contain object-bottom drop-shadow-[0_0_10px_rgba(255,190,90,0.45)]" style={{ maxHeight: 150 }} />
                <span className="mt-0.5 line-clamp-2 text-center text-[10px] leading-3 text-white/85">{potKindById.get(k)?.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-white/75">
            Ra vàng: 34% chậu mới của bộ · lệch thì lần vàng tới chắc chắn là chậu mới. Quay thêm <b className="text-amber-200">{toGold}</b> lần chắc chắn ra vàng
            {g.gacha.sinceGold + 1 >= SOFT_PITY ? ' (đang tăng tỉ lệ!)' : ''}.
            {g.gacha.insured && <b className="text-amber-200"> Lần vàng tới chắc chắn là chậu {set.name}.</b>}
          </p>
        </div>

        {/* cột nút */}
        <div className="flex w-56 shrink-0 flex-col gap-2">
          {TESTER_UIDS.includes(actor.uid) && (
            <button type="button" disabled={busy} className={`${BTN} h-8 text-xs from-emerald-500/60 to-teal-700/70`} onClick={() => void job(() => grantTestRolls(actor), `Đã thêm ${TEST_GRANT} Vọng Tinh (test)`)}>
              +{TEST_GRANT} Vọng Tinh (test)
            </button>
          )}
          <p className="text-[11px] leading-4 text-white/70">Đổi đá vũ trụ lấy Vọng Tinh ({ROLL_PRICE} đá / cục)</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy || g.stones < ROLL_PRICE} className={`${BTN} text-xs from-sky-500/60 to-blue-700/70`} onClick={() => void job(() => buyRolls(actor, 'vong_tinh', 1), 'Đã đổi 1 Vọng Tinh')}>
              Đổi 1
            </button>
            <button type="button" disabled={busy || g.stones < ROLL_PRICE * 10} className={`${BTN} text-xs from-sky-500/60 to-blue-700/70`} onClick={() => void job(() => buyRolls(actor, 'vong_tinh', 10), 'Đã đổi 10 Vọng Tinh')}>
              Đổi 10
            </button>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2">
            {([1, 10] as const).map((n) => (
              <button key={n} type="button" disabled={busy} onClick={() => void pull(n)} className={`${BTN} h-16 flex-col from-amber-400/70 to-fuchsia-600/70`}>
                <span className="text-base leading-5">Quay ×{n}</span>
                <span className="flex items-center gap-1 text-[11px] font-normal text-white/85">
                  <img src={ROLL_IMG.vong_tinh} alt="" className="h-4 w-4" /> {n}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] leading-3 text-white/45">Banner đồ trang trí (Sao Duyên) sắp có.</p>
        </div>
      </div>

      {msg && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <p className="border border-white/25 bg-black/60 px-4 py-2 text-sm font-semibold backdrop-blur-md">{msg}</p>
        </div>
      )}

      {view.panel && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45" onClick={() => setView({ kind: 'banner', panel: null })}>
          <div className="flex max-h-[86%] w-[30rem] flex-col border border-white/25 bg-indigo-950/85 shadow-2xl shadow-black/60 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/15 px-4">
              <p className="font-semibold">{view.panel === 'rates' ? 'Quy tắc & tỉ lệ' : 'Lịch sử quay'}</p>
              <button type="button" className="text-sm text-white/75" onClick={() => setView({ kind: 'banner', panel: null })}>Đóng</button>
            </div>
            <DragScroll axis="y" className="min-h-0 flex-1">
              {view.panel === 'rates' ? <Rates /> : <History g={g} />}
            </DragScroll>
          </div>
        </div>
      )}
    </div>
  )
}

const pctTxt = (v: number) => `${(Math.round(v * 10000) / 100).toLocaleString('vi-VN')}%`
function Rates() {
  return (
    <div className="space-y-2 px-4 py-3 text-xs leading-[18px]">
      {rateRows().map((r) => (
        <div key={r.label} className="flex justify-between gap-3 border-b border-white/10 pb-1.5">
          <span>
            {r.label}
            {r.note && <span className="block text-white/55">{r.note}</span>}
          </span>
          <b className="shrink-0 tabular-nums">{pctTxt(r.rate)}</b>
        </div>
      ))}
      <p className="text-white/75">• Lần 1–59 (tính từ lần ra vàng gần nhất): vàng 0,08%. Lần 60–63: 10%. Lần 64–79: tăng thêm 6% mỗi lần. Lần 80: chắc chắn vàng.</p>
      <p className="text-white/75">• Khi ra vàng: 33% chậu S ngoài banner, 33% chậu trùng của bộ banner, 34% chậu MỚI của bộ banner. Bị lệch thì lần vàng tới chắc chắn là chậu mới.</p>
      <p className="text-white/75">• Đủ bộ thì tính vòng mới: chậu chưa có bản thứ 2 vẫn tính là "mới". Chậu trùng được giữ lại (đặt ở tầng khác).</p>
      <p className="text-white/75">• Ra vàng cũng tính là ra tím. Bộ đếm được giữ khi đổi sang banner tháng sau.</p>
      <p className="text-white/75">• Quay ×10 có tỉ lệ y như 10 lần quay lẻ. {ROLL_PRICE} đá vũ trụ đổi 1 cục roll.</p>
    </div>
  )
}
function History({ g }: { g: Garden }) {
  const log = [...g.pullLog].reverse()
  if (!log.length) return <p className="px-4 py-6 text-center text-sm text-white/65">Chưa quay lần nào.</p>
  return (
    <div className="px-4 py-2 text-xs leading-5">
      {log.map((l, i) => (
        <div key={i} className="flex items-center justify-between border-b border-white/10 py-1">
          <span className={l.item.rarity === 'gold' ? 'font-semibold text-amber-200' : l.item.rarity === 'purple' ? 'font-semibold text-violet-200' : 'text-white/80'}>
            {itemName(l.item)}
            {l.item.type === 'pot' && l.item.off ? ' (lệch)' : ''}
          </span>
          <span className="text-white/50 tabular-nums">{new Date(l.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
        </div>
      ))}
    </div>
  )
}
