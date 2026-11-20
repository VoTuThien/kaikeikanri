import { useState, type ReactNode } from 'react'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import { buyCharms, buyFerts, buySeeds, errorText, exchangeOffer, placedIds, sell, sellShards, stonesToFeathers, type Garden } from '../data/api'
import { dayKey, FERTS, fertById, monthKey, SHARDS, shardById, STONE_TO_FEATHERS, type FertId, type ShardId } from '../data/items'
import { choicesOf, OFFERS, offerAvailable, type Offer } from '../data/exchange'
import { CHARM_SHOP_PRICE, CHARMS, MAX_POT_LEVEL, potRank } from '../data/upgrade'
import { potImage, potKindById, potSetById } from '../data/pots'
import type { Actor } from '../../../lib/firestore'
import { CROPS, cropById, cropImage, formatCoins, formatGrow, levelOf, seedImage } from '../data/crops'
import { INSECTS, insectById } from '../data/gacha'
import { FEATHER_IMG, STONE_IMG } from './GachaUi'
import { DragScroll } from './DragScroll'
import { BTN, RankBadge } from './PotUi'

// Popup trong game: Túi đồ (nông sản / hạt giống / côn trùng, bán nông sản lấy lông chim), Cửa hàng (mua hạt hạng B bằng lông chim) và Cẩm nang.
// Phủ kín khung game, khung giữa cuộn dọc bằng DragScroll.

// Số lông chim kèm icon (dùng trong chữ)
export function Feathers({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle tabular-nums ${className}`}>
      {formatCoins(n)}
      <img src={FEATHER_IMG} alt=" lông chim" className="h-4 w-4 object-contain" />
    </span>
  )
}

function Popup({ title, sub, onClose, tabs, children }: { title: string; sub?: ReactNode; onClose: () => void; tabs?: ReactNode; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45" onClick={onClose}>
      <div
        className="flex h-[calc(100%-24px)] w-[min(600px,calc(100%-24px))] flex-col border border-white/25 bg-indigo-950/80 shadow-2xl shadow-black/60 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/15 pr-2 pl-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg leading-6 font-light lowercase">{title}</p>
            {sub && <p className="truncate text-xs leading-4 text-white/65">{sub}</p>}
          </div>
          <button type="button" data-round aria-label="Đóng" onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-gradient-to-br from-sky-500/70 to-blue-600/70 shadow-lg active:scale-90">
            <LineIcon icon="cancel" className="h-5 w-5" />
          </button>
        </div>
        {tabs}
        <DragScroll axis="y" className="min-h-0 flex-1">{children}</DragScroll>
      </div>
    </div>
  )
}

const ROW = 'flex h-16 items-center gap-3 border-b border-white/10 px-4'

// ---- Túi đồ ----
type Tab = 'barn' | 'seeds' | 'insects' | 'pots' | 'items'
const TABS: { id: Tab; label: string }[] = [
  { id: 'barn', label: 'Nông sản' }, { id: 'seeds', label: 'Hạt giống' }, { id: 'insects', label: 'Côn trùng' }, { id: 'pots', label: 'Chậu' }, { id: 'items', label: 'Vật phẩm' },
]

export function BagPopup({ garden, actor, onClose, say, onUpgrade }: { garden: Garden; actor: Actor; onClose: () => void; say: (m: string) => void; onUpgrade: (potId: string) => void }) {
  const [tab, setTab] = useState<Tab>('barn')
  const [busy, setBusy] = useState<string | null>(null)
  const items = CROPS.filter((c) => (garden.barn[c.id] ?? 0) > 0)
  const total = items.reduce((s, c) => s + garden.barn[c.id] * c.sellPrice, 0)
  async function doSell(id: string | null) {
    if (busy) return
    setBusy(id ?? 'all')
    try { const got = await sell(actor, id); say(`Đã bán, nhận ${formatCoins(got)} lông chim`) } catch (err) { say(errorText(err)) } finally { setBusy(null) }
  }
  const seeds = CROPS.filter((c) => (garden.seeds[c.id] ?? 0) > 0)
  const insects = INSECTS.filter((i) => (garden.insects[i.id] ?? 0) > 0)
  return (
    <Popup
      title="Túi đồ"
      sub={<>Đang có <Feathers n={garden.feathers} /></>}
      onClose={onClose}
      tabs={
        <div className="grid shrink-0 grid-cols-5 gap-2 border-b border-white/15 p-2">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`h-9 border text-sm font-semibold transition ${tab === t.id ? 'border-white/50 bg-white/25' : 'border-white/15 bg-white/5 text-white/70'}`}>
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'barn' && (
        items.length === 0 ? <Empty>Kho đang trống. Thu hoạch cây chín (huy hiệu giỏ) rồi quay lại bán nhé.</Empty> : (
          <>
            {items.map((c) => (
              <div key={c.id} className={ROW}>
                <img src={cropImage(c.id)} alt="" className="h-11 w-11 object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold">{c.name} × {garden.barn[c.id]}</span>
                  <span className="block truncate text-xs leading-4 text-white/65"><Feathers n={c.sellPrice} /> / cái · <Feathers n={garden.barn[c.id] * c.sellPrice} /></span>
                </span>
                <button type="button" disabled={!!busy} onClick={() => doSell(c.id)} className={`${BTN} w-20 from-amber-400/70 to-orange-500/70`}>
                  {busy === c.id ? '…' : 'Bán'}
                </button>
              </div>
            ))}
            <div className="flex justify-end p-3">
              <button type="button" disabled={!!busy} onClick={() => doSell(null)} className={`${BTN} w-44 from-amber-400/70 to-orange-500/70`}>
                {busy === 'all' ? '…' : <>Bán tất cả · <Feathers n={total} className="ml-1" /></>}
              </button>
            </div>
          </>
        )
      )}
      {tab === 'seeds' && (
        seeds.length === 0 ? <Empty>Chưa có hạt giống. Mua ở Cửa hàng (bằng lông chim) hoặc quay gacha để nhận thêm hạt.</Empty> : seeds.map((c) => (
          <div key={c.id} className={ROW}>
            <img src={seedImage(c.id)} alt="" className="h-12 w-12 object-contain" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm leading-5 font-semibold"><RankBadge rank={c.rank} />{c.name}</span>
              <span className="block truncate text-xs leading-4 text-white/65">Cấp {c.level} · lớn {formatGrow(c.minutes)}</span>
            </span>
            <span className="w-14 text-right text-base font-bold tabular-nums">×{garden.seeds[c.id]}</span>
          </div>
        ))
      )}
      {tab === 'insects' && (
        insects.length === 0 ? <Empty>Chưa bắt được côn trùng nào. Chạm vào côn trùng bay quanh cây để bắt (dùng nâng cấp chậu sau này).</Empty> : insects.map((i) => (
          <div key={i.id} className={ROW}>
            <span className="flex h-11 w-11 items-center justify-center border border-white/20 bg-gradient-to-br from-emerald-400/50 to-teal-600/60"><Icon3D emoji={i.icon} className="h-7 w-7" /></span>
            <span className="min-w-0 flex-1 text-sm leading-5 font-semibold">{i.name}</span>
            <span className="w-14 text-right text-base font-bold tabular-nums">×{garden.insects[i.id]}</span>
          </div>
        ))
      )}
      {tab === 'pots' && <PotsTab garden={garden} onUpgrade={onUpgrade} />}
      {tab === 'items' && (
        CHARMS.every((c) => !garden.charms[c.id]) && FERTS.every((f) => !garden.ferts[f.id]) && SHARDS.every((x) => !garden.shards[x.id]) ? <Empty>Chưa có vật phẩm. Phân bón, bùa may mắn B mua ở Cửa hàng; bùa A, S, giữ cấp, mảnh vỡ sao nhận từ gacha / thư.</Empty> : [
          ...FERTS.filter((f) => garden.ferts[f.id] > 0).map((f) => ({ id: `f${f.id}`, icon: f.icon, name: f.name, note: `−${Math.round(f.cut * 100)}% thời gian lớn (chạm cây đang lớn để bón)`, n: garden.ferts[f.id] })),
          ...SHARDS.filter((x) => garden.shards[x.id] > 0).map((x) => ({ id: x.id, icon: x.icon, name: x.name, note: 'Đổi đồ ở Cửa hàng → Đổi sao', n: garden.shards[x.id] })),
          ...CHARMS.filter((c) => garden.charms[c.id] > 0).map((c) => ({ id: c.id, icon: c.icon, name: c.name, note: c.note, n: garden.charms[c.id] })),
        ].map((c) => (
          <div key={c.id} className={ROW}>
            <span className="flex h-11 w-11 items-center justify-center border border-white/20 bg-gradient-to-br from-amber-400/50 to-fuchsia-600/60"><Icon3D emoji={c.icon} className="h-7 w-7" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-5 font-semibold">{c.name}</span>
              <span className="block truncate text-xs leading-4 text-white/65">{c.note}</span>
            </span>
            <span className="w-14 text-right text-base font-bold tabular-nums">×{c.n}</span>
          </div>
        ))
      )}
    </Popup>
  )
}

// Tab Chậu của Túi đồ: mọi chậu (đang đặt + trong kho), nút Đập chậu
function PotsTab({ garden, onUpgrade }: { garden: Garden; onUpgrade: (potId: string) => void }) {
  const placed = placedIds(garden)
  const list = garden.pots
    .filter((p) => potKindById.has(p.kind))
    .sort((a, b) => Number(placed.has(b.id)) - Number(placed.has(a.id)) || b.level - a.level || a.kind.localeCompare(b.kind))
  if (!list.length) return <Empty>Chưa có chậu nào.</Empty>
  return (
    <>
      {list.map((p) => {
        const kind = potKindById.get(p.kind)!
        const set = potSetById.get(kind.set)
        return (
          <div key={p.id} className={ROW}>
            <img src={potImage(p.kind, p.level)} alt="" className="h-12 w-12 object-contain" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm leading-5 font-semibold"><RankBadge rank={potRank(p.kind)} />{kind.name}</span>
              <span className="block truncate text-xs leading-4 text-white/65">Bộ {set?.name} · Cấp {p.level} · {placed.has(p.id) ? 'Đang đặt' : 'Trong kho'}</span>
            </span>
            <button type="button" disabled={p.level >= MAX_POT_LEVEL} onClick={() => onUpgrade(p.id)} className={`${BTN} w-24 from-amber-400/70 to-fuchsia-600/70`}>
              {p.level >= MAX_POT_LEVEL ? 'Tối đa' : 'Đập chậu'}
            </button>
          </div>
        )
      })}
    </>
  )
}

// ---- Cửa hàng: 3 tab [Hạt & phân] (hạt hạng B + phân bón, lông chim) [Bùa] (bùa B, lông chim) [Đổi sao] (mảnh vỡ sao → đồ đặc biệt / lông chim, đá → lông chim) ----
const PACKS = [1, 10] as const
type ShopTab = 'seeds' | 'charms' | 'stars'
const SHOP_TABS: [ShopTab, string][] = [['seeds', 'Hạt & phân'], ['charms', 'Bùa'], ['stars', 'Đổi sao']]

function TabBar<T extends string>({ tabs, tab, setTab }: { tabs: [T, string][]; tab: T; setTab: (t: T) => void }) {
  return (
    <div className="grid shrink-0 gap-2 border-b border-white/15 p-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map(([id, label]) => (
        <button key={id} type="button" onClick={() => setTab(id)}
          className={`h-9 border text-sm font-semibold transition ${tab === id ? 'border-white/50 bg-white/25' : 'border-white/15 bg-white/5 text-white/70'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}
// Ô icon vật phẩm (bùa / phân / mảnh)
function ItemIcon({ emoji, tone = 'from-amber-400/50 to-fuchsia-600/60' }: { emoji: string; tone?: string }) {
  return <span className={`flex h-12 w-12 shrink-0 items-center justify-center border border-white/20 bg-gradient-to-br ${tone}`}><Icon3D emoji={emoji} className="h-7 w-7" /></span>
}
export const Shards = ({ id, n, className = '' }: { id: ShardId; n: number; className?: string }) => (
  <span className={`inline-flex items-center gap-0.5 align-middle tabular-nums ${className}`}>{n.toLocaleString('vi-VN')}<Icon3D emoji={shardById.get(id)!.icon} className="h-3.5 w-3.5" /></span>
)

export function ShopPopup({ garden, actor, onClose, say }: { garden: Garden; actor: Actor; onClose: () => void; say: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState<ShopTab>('seeds')
  const [choosing, setChoosing] = useState<Offer | null>(null)
  const level = levelOf(garden.xp)
  const list = CROPS.filter((c) => c.rank === 'B')
  const month = monthKey(), day = dayKey()
  const usedMonth = (id: string) => (garden.shop.month === month ? garden.shop.bought[id] ?? 0 : 0)
  const usedToday = (id: string) => (garden.shop.day === day ? garden.shop.today[id] ?? 0 : 0)

  async function job(key: string, fn: () => Promise<string>) {
    if (busy) return
    setBusy(key)
    try { say(await fn()) } catch (err) { say(errorText(err)) } finally { setBusy(null) }
  }
  const buy = (id: string, name: string, n: number) => job(`${id}:${n}`, async () => `Đã mua ${n} hạt ${name.toLowerCase()} · −${formatCoins(await buySeeds(actor, id, n))} lông chim`)
  const buyCharm = (n: number) => job(`charm:${n}`, async () => `Đã mua ${n} bùa may mắn B · −${formatCoins(await buyCharms(actor, n))} lông chim`)
  const buyFert = (id: FertId, n: number) => job(`fert${id}:${n}`, async () => `Đã mua ${n} túi ${fertById.get(id)!.name.toLowerCase()} · −${formatCoins(await buyFerts(actor, id, n))} lông chim`)
  const exchange = (o: Offer, choice: string | null) => job(o.id, async () => `Đã đổi: ${await exchangeOffer(actor, o.id, choice)}`)

  return (
    <Popup
      title="Cửa hàng"
      sub={<>Đang có <Feathers n={garden.feathers} /> · <Shards id="sao_sang" n={garden.shards.sao_sang} /> · <Shards id="sao" n={garden.shards.sao} /></>}
      onClose={onClose}
      tabs={<TabBar tabs={SHOP_TABS} tab={tab} setTab={setTab} />}
    >
      {tab === 'seeds' && (
        <>
          {FERTS.map((f) => {
            const left = f.dailyLimit === null ? null : f.dailyLimit - usedToday(`fert_${f.id}`)
            return (
              <div key={f.id} className={`${ROW} h-[72px]`}>
                <ItemIcon emoji={f.icon} tone="from-lime-400/50 to-emerald-700/60" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm leading-5 font-semibold"><RankBadge rank={f.id} />{f.name}</span>
                  <span className="block truncate text-xs leading-4 text-white/70">−{Math.round(f.cut * 100)}% thời gian lớn · <Feathers n={f.price} /> / túi</span>
                  <span className="block text-xs leading-4 text-white/55">Đang có ×{garden.ferts[f.id]}{left !== null ? ` · hôm nay còn mua ${left}` : ''}</span>
                </span>
                <div className="grid w-44 shrink-0 grid-cols-2 gap-2">
                  {(f.dailyLimit === null ? [1, 10] : [1, 5]).map((n) => (
                    <button key={n} type="button" disabled={!!busy || garden.feathers < f.price * n || (left !== null && left < n)} onClick={() => buyFert(f.id, n)} className={`${BTN} flex-col gap-0 px-1 leading-4`}>
                      <span>{busy === `fert${f.id}:${n}` ? '…' : `Mua ${n}`}</span>
                      <Feathers n={f.price * n} className="text-[11px] font-normal" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {list.map((c) => {
            const locked = level < c.level
            return (
              <div key={c.id} className={`${ROW} h-[72px] ${locked ? 'opacity-50' : ''}`}>
                <img src={seedImage(c.id)} alt="" className="h-12 w-12 object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm leading-5 font-semibold"><RankBadge rank={c.rank} />{c.name}</span>
                  <span className="block truncate text-xs leading-4 text-white/70">
                    {locked ? `Cần cấp ${c.level}` : <><Feathers n={c.seedPrice} /> / hạt · lớn {formatGrow(c.minutes)}</>}
                  </span>
                  <span className="block text-xs leading-4 text-white/55">Đang có ×{garden.seeds[c.id] ?? 0}</span>
                </span>
                <div className="grid w-44 shrink-0 grid-cols-2 gap-2">
                  {PACKS.map((n) => (
                    <button key={n} type="button" disabled={locked || !!busy || garden.feathers < c.seedPrice * n} onClick={() => buy(c.id, c.name, n)}
                      className={`${BTN} flex-col gap-0 px-1 leading-4`}>
                      <span>{busy === `${c.id}:${n}` ? '…' : `Mua ${n}`}</span>
                      <Feathers n={c.seedPrice * n} className="text-[11px] font-normal" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="px-4 py-3 text-xs leading-5 text-white/60">Hạt hạng A / S không bán ở cửa hàng: nhận từ gacha hoặc đổi bằng mảnh vỡ sao. Bán nông sản trong Túi đồ để có thêm lông chim.</p>
        </>
      )}

      {tab === 'charms' && (
        <>
          <div className={`${ROW} h-[72px]`}>
            <ItemIcon emoji="🍀" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm leading-5 font-semibold"><RankBadge rank="B" />Bùa may mắn B</span>
              <span className="block truncate text-xs leading-4 text-white/70">+5% tỉ lệ đập chậu · <Feathers n={CHARM_SHOP_PRICE} /> / bùa</span>
              <span className="block text-xs leading-4 text-white/55">Đang có ×{garden.charms.B}</span>
            </span>
            <div className="grid w-44 shrink-0 grid-cols-2 gap-2">
              {[1, 5].map((n) => (
                <button key={n} type="button" disabled={!!busy || garden.feathers < CHARM_SHOP_PRICE * n} onClick={() => buyCharm(n)} className={`${BTN} flex-col gap-0 px-1 leading-4`}>
                  <span>{busy === `charm:${n}` ? '…' : `Mua ${n}`}</span>
                  <Feathers n={CHARM_SHOP_PRICE * n} className="text-[11px] font-normal" />
                </button>
              ))}
            </div>
          </div>
          <p className="px-4 py-3 text-xs leading-5 text-white/60">Bùa may mắn A, S và bùa giữ cấp: rơi từ gacha, nhận qua thư, hoặc đổi bằng mảnh vỡ sao (tab Đổi sao).</p>
        </>
      )}

      {tab === 'stars' && (
        <>
          <p className="border-b border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/75">Đổi đồ (giới hạn số lần mỗi tháng, làm mới đầu tháng)</p>
          {OFFERS.filter(offerAvailable).map((o) => {
            const used = usedMonth(o.id)
            const out = used >= o.limit
            return (
              <div key={o.id} className={`${ROW} ${out ? 'opacity-50' : ''}`}>
                <ItemIcon emoji={o.icon} tone={o.pay === 'sao_sang' ? 'from-amber-300/60 to-orange-600/60' : 'from-violet-400/50 to-indigo-700/60'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold">{o.name}</span>
                  <span className="block truncate text-xs leading-4 text-white/65">Tháng này {used}/{o.limit} lần</span>
                </span>
                <button type="button" disabled={!!busy || out || garden.shards[o.pay] < o.price} onClick={() => (o.choose ? setChoosing(o) : exchange(o, null))}
                  className={`${BTN} w-28 flex-col gap-0 px-1 leading-4`}>
                  <span>{busy === o.id ? '…' : o.choose ? 'Chọn & đổi' : 'Đổi'}</span>
                  <Shards id={o.pay} n={o.price} className="text-[11px] font-normal" />
                </button>
              </div>
            )
          })}
          <p className="border-y border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/75">Đổi ra lông chim (1 chiều, không giới hạn)</p>
          {SHARDS.map((s) => (
            <div key={s.id} className={ROW}>
              <ItemIcon emoji={s.icon} tone={s.id === 'sao_sang' ? 'from-amber-300/60 to-orange-600/60' : 'from-violet-400/50 to-indigo-700/60'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm leading-5 font-semibold">{s.name} → lông chim</span>
                <span className="block truncate text-xs leading-4 text-white/65">1 mảnh = <Feathers n={s.feathers} /> · đang có {garden.shards[s.id]}</span>
              </span>
              <div className="grid w-44 shrink-0 grid-cols-2 gap-2">
                {[1, 10].map((n) => (
                  <button key={n} type="button" disabled={!!busy || garden.shards[s.id] < n} onClick={() => job(`sell${s.id}:${n}`, async () => `Đã đổi ${n} ${s.name.toLowerCase()} · +${formatCoins(await sellShards(actor, s.id, n))} lông chim`)}
                    className={`${BTN} text-xs`}>
                    {busy === `sell${s.id}:${n}` ? '…' : `Đổi ${n}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className={ROW}>
            <img src={STONE_IMG} alt="" className="h-12 w-12 object-contain" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-semibold">Đá vũ trụ → lông chim</span>
              <span className="block truncate text-xs leading-4 text-white/65">1 đá = <Feathers n={STONE_TO_FEATHERS} /> · đang có {garden.stones}</span>
            </span>
            <div className="grid w-44 shrink-0 grid-cols-2 gap-2">
              {[1, 16].map((n) => (
                <button key={n} type="button" disabled={!!busy || garden.stones < n} onClick={() => job(`stone:${n}`, async () => `Đã đổi ${n} đá · +${formatCoins(await stonesToFeathers(actor, n))} lông chim`)}
                  className={`${BTN} text-xs`}>
                  {busy === `stone:${n}` ? '…' : `Đổi ${n}`}
                </button>
              ))}
            </div>
          </div>
          <p className="px-4 py-3 text-xs leading-5 text-white/60">Mảnh vỡ sao sáng / mảnh vỡ sao nhận KÈM khi gacha ra món hạng S / A.</p>
        </>
      )}

      {choosing && choosing.choose && (
        <ChoosePicker offer={choosing} onClose={() => setChoosing(null)} onPick={(c) => { const o = choosing; setChoosing(null); void exchange(o, c) }} />
      )}
    </Popup>
  )
}

// Chọn loại (chậu / hạt / côn trùng) cho món đổi sao: dải cuộn ngang, chạm 1 ô để đổi luôn
function ChoosePicker({ offer, onClose, onPick }: { offer: Offer; onClose: () => void; onPick: (choice: string) => void }) {
  const items = choicesOf(offer.choose!)
  const label = (id: string) => potKindById.get(id)?.name ?? cropById.get(id)?.name ?? insectById.get(id)?.name ?? id
  const art = (id: string) => {
    if (potKindById.has(id)) return <img src={potImage(id, 1)} alt="" className="h-12 w-12 object-contain" />
    if (cropById.has(id)) return <img src={cropImage(id)} alt="" className="h-12 w-12 object-contain" />
    return <Icon3D emoji={insectById.get(id)?.icon ?? '🐛'} className="h-10 w-10" />
  }
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="border-t border-white/20 bg-indigo-950/90 pt-2 pb-3" onClick={(e) => e.stopPropagation()}>
        <p className="px-4 pb-1 text-xs text-white/75">{offer.name}: chạm 1 ô để đổi ({offer.price} {shardById.get(offer.pay)!.name.toLowerCase()})</p>
        <DragScroll axis="x" className="h-28">
          <div className="flex h-full gap-2 px-4">
            {items.map((id) => (
              <button key={id} type="button" onClick={() => onPick(id)} className="relative flex h-full w-24 shrink-0 flex-col items-center justify-center border border-white/20 bg-white/10 px-1 text-center">
                {potKindById.has(id) && <RankBadge rank={potRank(id)} className="absolute top-1 left-1" />}
                {art(id)}
                <span className="line-clamp-2 text-[10px] leading-3">{label(id)}</span>
                {potKindById.has(id) && <span className="text-[10px] text-white/55">Bộ {potSetById.get(potKindById.get(id)!.set)?.name}</span>}
              </button>
            ))}
          </div>
        </DragScroll>
      </div>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="p-5 text-sm leading-6 text-white/75">{children}</p>
}

// ---- Cẩm nang ----
const RULES = [
  'Chạm vòng sáng trống để đặt chậu. Chạm chậu trống để chọn hạt giống và gieo.',
  'Sau khi gieo, túi hạt lơ lửng trên chậu: nhấn vào túi rồi kéo lướt qua các chậu trống khác để gieo liên tục. Hết hạt thì túi biến mất.',
  'Cây lớn theo thời gian thật, đóng game cây vẫn lớn. Chạm cây có huy hiệu giọt nước để tưới: thu thêm 1 nông sản.',
  'Côn trùng bay quanh cây: chạm để bắt (+2 kinh nghiệm), dùng để đập chậu (nâng cấp). Cây chín (huy hiệu giỏ): chạm để thu hoạch.',
  'Phân bón: chạm cây đang lớn (đã tưới) → chọn phân B (−20%) / A (−40%) thời gian lớn, rồi kéo túi phân lướt qua cây khác để bón tiếp. Mỗi cây tối đa 2 lần, tổng tối đa −60%.',
  'Gacha ra món hạng S / A được KÈM mảnh vỡ sao sáng / mảnh vỡ sao: đổi đồ đặc biệt ở Cửa hàng → Đổi sao.',
  'Nhiệm vụ hằng ngày (nút 📝 trong menu ☰): 5 nhiệm vụ mỗi ngày, xong thì bấm nhận lông chim, đá vũ trụ, kinh nghiệm; xong cả 5 được thêm Sao Duyên.',
  'Đập chậu: nhấn giữ chậu → Đập chậu, hoặc Túi đồ → Chậu. Có tỉ lệ thành công; bỏ thêm chậu trong kho / bùa may mắn để tăng tỉ lệ (nút ? giải thích chi tiết).',
  'Thu hoạch được kinh nghiệm để lên cấp, mở khoá cây mới và tầng mây mới. Bán nông sản trong Túi đồ để nhận lông chim.',
  'Dùng lông chim mua hạt giống ở Cửa hàng (nút xe đẩy góc phải trên).',
  'Hạt giống có hạng B (xanh biển), A (tím), S (vàng); hạt hạng A / S chỉ có từ gacha.',
]

export function GuidePopup({ garden, onClose }: { garden: Garden; onClose: () => void }) {
  const level = levelOf(garden.xp)
  return (
    <Popup title="Cẩm nang" sub={`Bạn đang ở cấp ${level}`} onClose={onClose}>
      <ul className="list-disc space-y-1 py-3 pr-4 pl-8 text-sm leading-5 text-white/85">
        {RULES.map((r) => <li key={r}>{r}</li>)}
      </ul>
      <p className="border-y border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/75">Các loại cây</p>
      {CROPS.map((c) => (
        <div key={c.id} className={`${ROW} ${level < c.level ? 'opacity-50' : ''}`}>
          <img src={cropImage(c.id)} alt="" className="h-11 w-11 object-contain" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm leading-5 font-semibold">
              <RankBadge rank={c.rank} />{c.name} <span className="font-normal text-white/60">· cấp {c.level}</span>
            </span>
            <span className="block truncate text-xs leading-4 text-white/70">Lớn {formatGrow(c.minutes)} · thu {c.yield} (+1 nếu tưới) × <Feathers n={c.sellPrice} /> · +{c.xp} kinh nghiệm{c.rank === 'B' && <> · hạt <Feathers n={c.seedPrice} /></>}</span>
          </span>
        </div>
      ))}
    </Popup>
  )
}
