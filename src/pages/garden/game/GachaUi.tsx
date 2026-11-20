import { lazy, Suspense, useMemo, useState } from 'react'
import { LineIcon } from '../../../components/ui/Fab'
import { useGarden } from '../data/GardenContext'
import { buyRolls, errorText, pullPots, type Garden } from '../data/api'
import type { RollKind } from '../data/gacha'
import { CROPS, seedImage } from '../data/crops'
import {
  bannerOf,
  insectById,
  itemBase,
  itemName,
  rateRows,
  ROLL_PRICE,
  type PullItem,
  type Rarity,
} from '../data/gacha'
import { potImage, potKindById, potSetById } from '../data/pots'
import { DragScroll } from './DragScroll'
import { charmById } from '../data/upgrade'
import { fertById, shardById, type ShardId } from '../data/items'
import { BTN, RankBadge } from './PotUi'
import { ItemImg } from './ItemImg'
import { ItemTile, TileFooter } from './ItemTile'
import { GLASS_ROUND } from './glass'
import { BuyDialog, ConfirmDialog, type ItemRank } from './BuyDialog'

// Màn hình gacha trong game (xem CLAUDE.md "Gacha"): banner chậu (Vọng Tinh). Bấm quay → ghi Firestore → hiệu ứng mở cục roll
// (RollReveal) → hiện từng món (chạm để sang món tiếp) → bảng tổng kết.

const RollReveal = lazy(() => import('./RollReveal').then((m) => ({ default: m.RollReveal })))

export const ROLL_IMG = { vong_tinh: '/game/roll/vong_tinh.webp', sao_duyen: '/game/roll/sao_duyen.webp' }
export const STONE_IMG = '/game/tien/da_vu_tru.webp'
export const FEATHER_IMG = '/game/tien/long_chim.webp' // lông chim: tiền mua hạt / bán nông sản

// Bóng sáng quanh ô khi ra món hiếm
const GLOW: Record<Rarity, string> = {
  gold: 'shadow-[0_0_22px_rgba(253,211,77,0.6)]',
  purple: 'shadow-[0_0_18px_rgba(196,148,255,0.5)]',
  blue: '',
}

// Ảnh + hạng của 1 món (côn trùng mặc định hạng B; bùa giữ cấp tính hạng A)
function itemArt(item: PullItem): { img?: string; emoji: string } {
  if (item.type === 'pot') return { img: potImage(item.kind, 1), emoji: '🪴' }
  if (item.type === 'charm') { const c = charmById.get(item.charm); return { img: c?.img, emoji: c?.icon ?? '🍀' } }
  if (item.type === 'fert') { const f = fertById.get(item.fert); return { img: f?.img, emoji: f?.icon ?? '🌱' } }
  if (item.type === 'insect') { const i = insectById.get(item.insect); return { img: i?.img, emoji: i?.icon ?? '🐛' } }
  return { img: seedImage(item.crop), emoji: '🌱' }
}
function itemRank(item: PullItem): ItemRank {
  if (item.type === 'pot') return potSetById.get(potKindById.get(item.kind)?.set ?? '')?.rank ?? 'B'
  if (item.type === 'seed') return CROPS.find((c) => c.id === item.crop)?.rank ?? 'B'
  if (item.type === 'charm') return item.charm === 'keep' ? 'A' : item.charm
  if (item.type === 'fert') return item.fert
  return 'B'
}
// Nhãn góc phải trên: chậu mới / trùng
const itemTag = (item: PullItem) => (item.type !== 'pot' ? undefined : item.isNew ? 'MỚI!' : 'Trùng')

function ItemCard({ item, big = false }: { item: PullItem; big?: boolean }) {
  const set = item.type === 'pot' ? potSetById.get(potKindById.get(item.kind)?.set ?? '') : undefined
  const { name, qty } = itemBase(item)
  const tag = itemTag(item)
  const tile = (
    <ItemTile {...itemArt(item)} name={name} qty={qty} rank={itemRank(item)} big={big} fill={!big} glow={GLOW[item.rarity]}
      tr={tag && <span className={item.type === 'pot' && item.isNew ? 'text-amber-200' : 'text-white/80'}>{tag}</span>}
      footer={item.shards && <TileFooter className={big ? '' : 'h-6 text-[11px]'}><ShardTag shards={item.shards} big={big} /></TileFooter>} />
  )
  if (!big) return tile
  return (
    <div className="flex w-64 flex-col items-center gap-1 text-center">
      <div className="w-full">{tile}</div>
      {set && <span className="text-sm leading-5 text-white/75">Bộ {set.name}</span>}
      {item.type === 'pot' && item.off && <span className="text-xs text-white/60">Lần vàng tới chắc chắn là chậu mới của banner</span>}
    </div>
  )
}

// Mảnh vỡ sao đi kèm món (ô dưới thẻ món)
function ShardTag({ shards, big }: { shards: Partial<Record<ShardId, number>>; big: boolean }) {
  return (
    <span className="flex items-center gap-1.5 font-bold text-amber-200">
      {(Object.entries(shards) as [ShardId, number][]).filter(([, n]) => n > 0).map(([id, n]) => (
        <span key={id} className="flex items-center gap-0.5"><ItemImg img={shardById.get(id)!.img} emoji={shardById.get(id)!.icon} className={big ? 'h-5 w-5' : 'h-3.5 w-3.5'} />+{n}{big ? ` ${shardById.get(id)!.name.toLowerCase()}` : ''}</span>
      ))}
    </span>
  )
}

// Ô số lượng (cục roll / đá) trên thanh trên cùng
export function Count({ img, n, label, onPlus }: { img: string; n: number; label: string; onPlus?: () => void }) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <img src={img} alt="" className="h-7 w-7 object-contain" />
      <span className="text-sm font-bold tabular-nums [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">{n.toLocaleString('vi-VN')}</span>
      {onPlus && (
        <button type="button" data-round aria-label={`Đổi thêm ${label}`} onClick={onPlus} className={`${GLASS_ROUND} ml-0.5 h-7 w-7`}>
          <LineIcon icon="add" className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
// Cục roll khi mua bằng đá vũ trụ (dialog mua): hạng = màu nền ô vật phẩm (Vọng Nguyệt ánh xanh biển = B, Vọng Tinh ánh vàng = S)
export const ROLL_GOODS: Record<RollKind, { name: string; rank: ItemRank; desc: string }> = {
  vong_tinh: { name: 'Vọng Tinh', rank: 'S', desc: 'Cục roll của banner chậu. Mỗi cục quay được 1 lần ở banner chậu hạng S đang mở.' },
  sao_duyen: { name: 'Vọng Nguyệt', rank: 'B', desc: 'Cục roll của banner đồ trang trí (sắp mở). Mỗi cục quay được 1 lần ở banner đồ trang trí.' },
}
// Nút quay x 1 / x 10: cao bằng nút X (h-10); bỏ màu gốc của BTN để màu riêng của từng nút không bị đè
const BTN_PLAIN = BTN.replace(/from-\S+ to-\S+/, '') // BTN đã bỏ màu gốc: thêm from-* to-* riêng mới có tác dụng
const PULL_BTN = `${BTN_PLAIN} h-10 gap-1.5 text-base`
// Ảnh nền banner theo bộ chậu (public/game/banner/…); chưa có ảnh thì dùng nền gradient
const BANNER_IMAGE: Record<string, string> = {}

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

  // Thiếu Vọng Tinh: hỏi dùng đá vũ trụ để bù; đồng ý thì kiểm tra đủ đá chưa, đủ thì mua phần thiếu rồi quay
  const [shortfall, setShortfall] = useState<{ count: 1 | 10; need: number } | null>(null)
  const [buying, setBuying] = useState<RollKind | null>(null)
  async function pull(count: 1 | 10) {
    if (busy) return
    if (g.rolls.vong_tinh < count) {
      setShortfall({ count, need: count - g.rolls.vong_tinh })
      return
    }
    await doPull(count)
  }
  async function coverAndPull() {
    if (!shortfall || busy) return
    const { count, need } = shortfall
    const cost = need * ROLL_PRICE
    if (g.stones < cost) {
      setShortfall(null)
      setMsg(`Không đủ đá vũ trụ: cần ${cost.toLocaleString('vi-VN')}, đang có ${g.stones.toLocaleString('vi-VN')}`)
      return
    }
    setBusy(true)
    try {
      await buyRolls(actor, 'vong_tinh', need)
    } catch (err) {
      setMsg(errorText(err))
      setBusy(false)
      return
    } finally {
      setShortfall(null)
    }
    setBusy(false)
    await doPull(count)
  }
  async function buy(kind: RollKind, n: number) {
    setBusy(true)
    try {
      await buyRolls(actor, kind, n)
      setMsg(`Đã đổi ${n} ${ROLL_GOODS[kind].name} · −${(n * ROLL_PRICE).toLocaleString('vi-VN')} đá vũ trụ`)
      setBuying(null)
    } catch (err) {
      setMsg(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  async function doPull(count: 1 | 10) {
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
            data-round
            aria-label="Bỏ qua"
            className={`${GLASS_ROUND} absolute top-3 h-10 w-10`}
            style={{ right: 'calc(var(--safe-r) + 12px)' }}
            onClick={(e) => {
              e.stopPropagation()
              setView({ kind: 'sum', items: view.items, count: view.count })
            }}
          >
            <LineIcon icon="skip" className="h-5 w-5" />
          </button>
        )}
      </div>
    )
  }

  if (view.kind === 'sum')
    return (
      <div className="absolute inset-0 z-50 flex flex-col bg-gradient-to-b from-[#0a0620] to-[#1c0f3d] pt-3 pb-3" style={{ paddingLeft: 'calc(var(--safe-l) + 14px)', paddingRight: 'calc(var(--safe-r) + 14px)' }}>
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
          <button type="button" className={`${BTN_PLAIN} from-slate-400/45 to-slate-600/55`} onClick={() => setView({ kind: 'banner', panel: null })}>
            Xong
          </button>
          <button type="button" className={BTN} disabled={busy} onClick={() => void pull(view.count)}>
            Quay tiếp ×{view.count}
          </button>
        </div>
      </div>
    )

  // ---- Màn hình banner: nền banner phủ kín khung game (sau này thay bằng ảnh BANNER_IMAGE), nút X đè lên nền ----
  const bgImg = BANNER_IMAGE[banner.setId]
  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-[#120a33]">
      {/* nền banner */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-orange-500/35 via-rose-700/30 to-indigo-900/60 bg-cover bg-center"
        style={bgImg ? { backgroundImage: `url(${bgImg})` } : undefined}
      />
      {/* trái trên: đóng + tên banner */}
      <div className="absolute top-3 flex items-start gap-3" style={{ left: 'calc(var(--safe-l) + 12px)' }}>
        <button type="button" data-round aria-label="Đóng gacha" onClick={onClose} className={`${GLASS_ROUND} h-10 w-10`}>
          <LineIcon icon="cancel" className="h-5 w-5" />
        </button>
        <div className="[text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
          <p className="flex items-center gap-1.5 text-xl leading-7 font-semibold"><RankBadge rank="S" /> {set.name}</p>
          <p className="text-xs leading-5 text-white/80">Banner chậu · tháng {banner.month} · đổi banner ngày {banner.end.getDate()}/{banner.end.getMonth() + 1}</p>
        </div>
      </div>
      {/* phải trên: số cục roll + đá (không khung) */}
      <div className="absolute top-3 flex h-10 items-center gap-3" style={{ right: 'calc(var(--safe-r) + 12px)' }}>
        <Count img={ROLL_IMG.vong_tinh} n={g.rolls.vong_tinh} label="Vọng Tinh" onPlus={() => setBuying('vong_tinh')} />
        <Count img={ROLL_IMG.sao_duyen} n={g.rolls.sao_duyen} label="Vọng Nguyệt" onPlus={() => setBuying('sao_duyen')} />
        <Count img={STONE_IMG} n={g.stones} label="Đá vũ trụ" />
      </div>
      {/* giữa: 6 chậu cấp 6 của bộ + dòng bảo hiểm */}
      <div className="absolute inset-x-0 top-16 bottom-[5.5rem] flex flex-col" style={{ paddingLeft: 'calc(var(--safe-l) + 24px)', paddingRight: 'calc(var(--safe-r) + 24px)' }}>
        <div className="grid min-h-0 flex-1 grid-cols-6 items-end gap-2">
          {set.kinds.map((k) => (
            <div key={k} className="flex h-full min-h-0 min-w-0 flex-col items-center justify-end">
              <img src={potImage(k, 6)} alt="" draggable={false} className="min-h-0 w-full flex-1 object-contain object-bottom drop-shadow-[0_0_10px_rgba(255,190,90,0.45)]" style={{ maxHeight: 170 }} />
              <span className="mt-0.5 line-clamp-2 text-center text-[10px] leading-3 text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">{potKindById.get(k)?.name}</span>
            </div>
          ))}
        </div>
      </div>
      {/* trái dưới: nút tròn kính [?] quy tắc & tỉ lệ, [đồng hồ] lịch sử */}
      <div className="absolute bottom-4 flex gap-3" style={{ left: 'calc(var(--safe-l) + 12px)' }}>
        <button type="button" data-round aria-label="Quy tắc & tỉ lệ" title="Quy tắc & tỉ lệ" onClick={() => setView({ kind: 'banner', panel: 'rates' })} className={`${GLASS_ROUND} h-10 w-10`}><LineIcon icon="help" className="h-6 w-6" /></button>
        <button type="button" data-round aria-label="Lịch sử quay" title="Lịch sử quay" onClick={() => setView({ kind: 'banner', panel: 'history' })} className={`${GLASS_ROUND} h-10 w-10`}><LineIcon icon="clock" className="h-6 w-6" /></button>
      </div>
      {/* phải dưới: 2 nút quay rộng bằng nhau */}
      <div className="absolute bottom-4 grid w-[17rem] grid-cols-2 gap-3" style={{ right: 'calc(var(--safe-r) + 12px)' }}>
        {([1, 10] as const).map((n) => (
          <button key={n} type="button" disabled={busy} onClick={() => void pull(n)} aria-label={`Quay ${n} lần`}
            className={`${PULL_BTN} ${n === 1 ? 'from-sky-400/85 to-blue-700/85' : 'from-amber-400/85 to-fuchsia-600/85'}`}>
            <img src={ROLL_IMG.vong_tinh} alt="" className="h-7 w-7 object-contain" />
            <span className="tabular-nums">x {n}</span>
          </button>
        ))}
      </div>

      {msg && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center">
          <p className="border border-white/25 bg-black/60 px-4 py-2 text-sm font-semibold backdrop-blur-md">{msg}</p>
        </div>
      )}

      {buying && (
        <BuyDialog
          name={ROLL_GOODS[buying].name}
          img={ROLL_IMG[buying]}
          rank={ROLL_GOODS[buying].rank}
          desc={ROLL_GOODS[buying].desc}
          have={g.rolls[buying]}
          price={ROLL_PRICE}
          payImg={STONE_IMG}
          payName="đá vũ trụ"
          payHave={g.stones}
          busy={busy}
          onConfirm={(n) => void buy(buying, n)}
          onClose={() => setBuying(null)}
        />
      )}
      {shortfall && (
        <ConfirmDialog busy={busy} onConfirm={() => void coverAndPull()} onClose={() => setShortfall(null)}>
          Không đủ Vọng Tinh để quay {shortfall.count} lần (đang có {g.rolls.vong_tinh}).
          <br />
          Dùng <b className="text-amber-200">{(shortfall.need * ROLL_PRICE).toLocaleString('vi-VN')} đá vũ trụ</b> để đổi {shortfall.need} Vọng Tinh còn thiếu?
          <span className="mt-1 block text-xs text-white/60">Đang có {g.stones.toLocaleString('vi-VN')} đá vũ trụ</span>
        </ConfirmDialog>
      )}
      {view.panel && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45" onClick={() => setView({ kind: 'banner', panel: null })}>
          <div className="flex max-h-[86%] w-[30rem] flex-col border border-white/25 bg-indigo-950/85 shadow-2xl shadow-black/60 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/15 pr-2 pl-4">
              <p className="font-semibold">{view.panel === 'rates' ? 'Quy tắc & tỉ lệ' : 'Lịch sử quay'}</p>
              <button type="button" data-round aria-label="Đóng" onClick={() => setView({ kind: 'banner', panel: null })} className={`${GLASS_ROUND} h-8 w-8`}>
                <LineIcon icon="cancel" className="h-4 w-4" />
              </button>
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
      <p className="text-white/75">• Thưởng KÈM mảnh vỡ sao (đổi đồ ở Cửa hàng): chậu S +10 mảnh vỡ sao sáng (trùng +15), bùa S +3, 10 hạt hạng S +1; chậu A +5 mảnh vỡ sao (trùng +8), bùa A +2, 10 hạt hạng A +1.</p>
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
