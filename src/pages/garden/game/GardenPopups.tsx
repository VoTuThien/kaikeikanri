import { useState, type ReactNode } from 'react'
import { buyCharms, buyFerts, buyRolls, buySeeds, errorText, exchangeOffer, placedIds, sell, sellShards, stonesToFeathers, type Garden } from '../data/api'
import { dayKey, FERTS, fertById, monthKey, SHARDS, shardById, STONE_TO_FEATHERS, type ShardId } from '../data/items'
import { choicesOf, OFFERS, offerAvailable, type Offer } from '../data/exchange'
import { CHARM_SHOP_PRICE, charmById, CHARMS, MAX_POT_LEVEL, potRank, UPGRADE_INSECTS } from '../data/upgrade'
import { byRank, potImage, potKindById, potSetById } from '../data/pots'
import type { Actor } from '../../../lib/firestore'
import { CROPS, cropById, cropImage, formatCoins, formatGrow, levelOf, seedImage } from '../data/crops'
import { INSECTS, insectById, ROLL_PRICE } from '../data/gacha'
import { Count, FEATHER_IMG, ROLL_GOODS as ROLL_INFO, ROLL_IMG, STONE_IMG } from './GachaUi'
import { BuyDialog, RANK_GRADIENT, type ItemRank } from './BuyDialog'
import { ItemTile, TileFooter } from './ItemTile'
import { ItemImg } from './ItemImg'
import { DragScroll } from './DragScroll'
import { CHANGELOG } from '../data/changelog'
import { ChangelogList } from './NewsUi'
import { BTN, RankBadge } from './PotUi'
import { SideTabScreen, type SideTab } from './SideTabScreen'

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


const ROW = 'flex h-16 items-center gap-3 border-b border-white/10 px-3' // dòng danh sách (Cẩm nang)
const BTN_PLAIN = BTN.replace(/from-\S+ to-\S+/, '') // BTN bỏ màu gốc để thêm from-* to-* riêng

// ---- Túi đồ ----
// KHÔNG có tiêu đề: thanh trên = nút đóng + tiền tệ (như màn hình Ước nguyện). Cột trái = tab; giữa = lưới ô vuông (ảnh, số lượng góc phải dưới,
// nền kính màu theo hạng); phải = khung chi tiết của ô đang chọn (tên, loại, ảnh lớn, đang có, mô tả, nguồn, nút [Bán] / [Đập]).
type Tab = 'barn' | 'seeds' | 'insects' | 'pots' | 'items'
const TABS: SideTab<Tab>[] = [
  { id: 'barn', label: 'Nông sản', icon: '🧺' }, { id: 'seeds', label: 'Hạt giống', icon: '🫘' }, { id: 'insects', label: 'Côn trùng', icon: '🐞' },
  { id: 'pots', label: 'Chậu', icon: '🪴' }, { id: 'items', label: 'Vật phẩm', icon: '🎁' },
]

// Tiền tệ ở thanh trên (Cửa hàng, Túi đồ): icon + số, không khung, như màn hình Ước nguyện
function Wallet({ garden }: { garden: Garden }) {
  return (
    <div className="flex items-center gap-4">
      <Count img={FEATHER_IMG} n={garden.feathers} label="Lông chim" />
      <Count img={STONE_IMG} n={garden.stones} label="Đá vũ trụ" />
      <Count img={shardById.get('sao_sang')!.img} n={garden.shards.sao_sang} label="Mảnh vỡ sao sáng" />
      <Count img={shardById.get('sao')!.img} n={garden.shards.sao} label="Mảnh vỡ sao" />
    </div>
  )
}

interface BagEntry {
  key: string
  name: string
  type: string // dòng loại dưới tên (vd "Nông sản", "Chậu · Bộ Đất nung")
  img?: string
  emoji: string
  rank: ItemRank
  count: string // góc phải dưới ô (số lượng / cấp)
  tag?: string // góc trái trên ô (vd "Đang đặt")
  have: string // "Đang có …" trong khung chi tiết
  desc: ReactNode
  source: string
  actions?: { label: ReactNode; onClick: () => void; disabled?: boolean; tone: string }[]
}

function BagTile({ e, on, onClick }: { e: BagEntry; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative flex aspect-square flex-col overflow-hidden border border-b-[3px] shadow-lg shadow-black/40 backdrop-blur-md transition active:scale-95 ${RANK_GRADIENT[e.rank]} ${on ? 'border-amber-200 outline-2 outline-offset-2 outline-amber-200/80' : 'border-white/20'}`}>
      <RankBadge rank={e.rank} className="absolute top-1 left-1 z-10" />
      {e.tag && <span className="absolute top-1 right-1 z-10 bg-black/55 px-1 text-[9px] leading-[14px] font-semibold">{e.tag}</span>}
      <span className="flex min-h-0 flex-1 items-center justify-center">
        <ItemImg img={e.img} emoji={e.emoji} className="h-[64%] w-[64%] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]" />
      </span>
      <span className="h-5 shrink-0 bg-black/35 pr-1.5 text-right text-xs leading-5 font-bold tabular-nums">{e.count}</span>
    </button>
  )
}

function BagDetail({ e }: { e: BagEntry }) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className={`relative h-36 shrink-0 overflow-hidden border border-b-[3px] border-white/20 ${RANK_GRADIENT[e.rank]}`}>
        <div className="relative z-10 px-3 pt-2 pr-24">
          <p className="text-lg leading-6 font-bold [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">{e.name}</p>
          <p className="text-xs leading-4 text-white/75">{e.type}</p>
        </div>
        <ItemImg img={e.img} emoji={e.emoji} className="absolute top-3 right-2 h-28 w-28 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
        <p className="absolute bottom-2 left-3 z-10 text-sm font-bold text-amber-100 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">{e.have}</p>
      </div>
      <DragScroll axis="y" className="min-h-0 flex-1">
        <div className="text-sm leading-6 text-white/90">{e.desc}</div>
        <p className="mt-2 border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs leading-5 text-white/70">{e.source}</p>
      </DragScroll>
      {e.actions && (
        <div className={`grid shrink-0 gap-2 ${e.actions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {e.actions.map((a, i) => (
            <button key={i} type="button" disabled={a.disabled} onClick={a.onClick} className={`${BTN_PLAIN} ${a.tone}`}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

const BAG_EMPTY: Record<Tab, string> = {
  barn: 'Kho đang trống. Chạm vào cây chín để thu hoạch rồi quay lại bán nhé.',
  seeds: 'Chưa có hạt giống. Mua ở Cửa hàng (bằng lông chim) hoặc quay gacha để nhận thêm hạt.',
  insects: 'Chưa bắt được côn trùng nào. Chạm vào côn trùng bay quanh cây để bắt, dùng để đập chậu.',
  pots: 'Chưa có chậu nào.',
  items: 'Chưa có vật phẩm. Phân bón, bùa may mắn B mua ở Cửa hàng; bùa A, S, giữ cấp, mảnh vỡ sao nhận từ gacha / thư.',
}

export function BagPopup({ garden, actor, onClose, say, onUpgrade }: { garden: Garden; actor: Actor; onClose: () => void; say: (m: string) => void; onUpgrade: (potId: string) => void }) {
  const [tab, setTab] = useState<Tab>('barn')
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function doSell(id: string) {
    if (busy) return
    setBusy(true)
    try { const got = await sell(actor, id); say(`Đã bán, nhận ${formatCoins(got)} lông chim`) } catch (err) { say(errorText(err)) } finally { setBusy(false) }
  }
  const n = (x: number) => x.toLocaleString('vi-VN')

  let entries: BagEntry[] = []
  if (tab === 'barn') entries = CROPS.filter((c) => (garden.barn[c.id] ?? 0) > 0).map((c) => {
    const k = garden.barn[c.id]
    return {
      key: c.id, name: c.name, type: 'Nông sản', img: cropImage(c.id), emoji: c.icon, rank: c.rank, count: n(k), have: `Đang có ${n(k)}`,
      desc: <>Nông sản thu hoạch từ cây {c.name.toLowerCase()}. Bán được <Feathers n={c.sellPrice} /> / cái; bán hết {n(k)} cái được <Feathers n={k * c.sellPrice} />.</>,
      source: 'Thu hoạch cây chín',
      actions: [{ label: busy ? '…' : <>Bán · <Feathers n={k * c.sellPrice} className="ml-1" /></>, onClick: () => doSell(c.id), disabled: busy, tone: 'from-amber-400/80 to-rose-500/80' }],
    }
  })
  if (tab === 'seeds') entries = CROPS.filter((c) => (garden.seeds[c.id] ?? 0) > 0).map((c) => ({
    key: c.id, name: `Hạt ${c.name.toLowerCase()}`, type: `Hạt giống · Hạng ${c.rank}`, img: seedImage(c.id), emoji: c.icon, rank: c.rank, count: n(garden.seeds[c.id]), have: `Đang có ${n(garden.seeds[c.id])}`,
    desc: <>Chạm chậu trống để gieo (cần cấp {c.level}). Lớn trong <b>{formatGrow(c.minutes)}</b>, mỗi lần thu {c.yield} nông sản (tưới thêm 1), +{c.xp} kinh nghiệm.</>,
    source: c.rank === 'B' ? 'Cửa hàng (lông chim) · gacha · thư' : 'Gacha · đổi mảnh vỡ sao · thư',
  }))
  if (tab === 'insects') entries = INSECTS.filter((i) => (garden.insects[i.id] ?? 0) > 0).map((i) => {
    const sets = Object.entries(UPGRADE_INSECTS).filter(([, v]) => v.includes(i.id)).map(([s]) => potSetById.get(s)?.name).filter(Boolean)
    return {
      key: i.id, name: i.name, type: 'Côn trùng', img: i.img, emoji: i.icon, rank: 'B' as ItemRank, count: n(garden.insects[i.id]), have: `Đang có ${n(garden.insects[i.id])}`,
      desc: <>Dùng để đập chậu (nâng cấp chậu).{sets.length > 0 && <> Các bộ chậu cần {i.name.toLowerCase()}: {sets.join(', ')}.</>}</>,
      source: 'Bắt côn trùng bay quanh cây · gacha · thư · đổi mảnh vỡ sao',
    }
  })
  if (tab === 'pots') {
    const placed = placedIds(garden)
    entries = garden.pots
      .filter((p) => potKindById.has(p.kind))
      .sort((a, b) => Number(placed.has(b.id)) - Number(placed.has(a.id)) || b.level - a.level || a.kind.localeCompare(b.kind))
      .map((p) => {
        const kind = potKindById.get(p.kind)!
        const set = potSetById.get(kind.set)
        const max = p.level >= MAX_POT_LEVEL
        return {
          key: p.id, name: kind.name, type: `Chậu · Bộ ${set?.name ?? ''} · Hạng ${potRank(p.kind)}`, img: potImage(p.kind, p.level), emoji: '🪴', rank: potRank(p.kind),
          count: `Lv${p.level}`, tag: placed.has(p.id) ? 'Đang đặt' : undefined, have: `Cấp ${p.level}/${MAX_POT_LEVEL}`,
          desc: <>Chậu thuộc bộ {set?.name}. Đặt nhiều chậu KHÁC NHAU của bộ trên cùng 1 tầng để nhận hiệu ứng bộ; cấp chậu càng cao hiệu ứng càng mạnh.</>,
          source: placed.has(p.id) ? 'Đang đặt trên tầng mây' : 'Trong kho',
          actions: [{ label: max ? 'Tối đa' : 'Đập', onClick: () => onUpgrade(p.id), disabled: max, tone: 'from-amber-400/80 to-fuchsia-600/80' }],
        }
      })
  }
  if (tab === 'items') entries = [
    ...FERTS.filter((f) => garden.ferts[f.id] > 0).map((f): BagEntry => ({
      key: `f${f.id}`, name: f.name, type: 'Phân bón', img: f.img, emoji: f.icon, rank: f.id, count: n(garden.ferts[f.id]), have: `Đang có ${n(garden.ferts[f.id])}`,
      desc: <>Rút <b>{Math.round(f.cut * 100)}%</b> thời gian lớn. Chạm cây đang lớn (đã tưới) để bón; mỗi cây tối đa 2 lần, tổng tối đa −60%.</>,
      source: 'Cửa hàng · gacha · đổi mảnh vỡ sao · thư',
    })),
    ...CHARMS.filter((c) => garden.charms[c.id] > 0).map((c): BagEntry => ({
      key: `c${c.id}`, name: c.name, type: 'Bùa', img: c.img, emoji: c.icon, rank: c.id === 'keep' ? 'A' : c.id, count: n(garden.charms[c.id]), have: `Đang có ${n(garden.charms[c.id])}`,
      desc: <>{c.note}. Dùng khi đập chậu{c.id === 'keep' ? ' (tối đa 1 bùa / lần)' : ' (tối đa 3 bùa may mắn / lần)'}.</>,
      source: c.id === 'B' ? 'Cửa hàng · gacha · thư' : 'Gacha · đổi mảnh vỡ sao · thư',
    })),
    ...SHARDS.filter((x) => garden.shards[x.id] > 0).map((x): BagEntry => ({
      key: `s${x.id}`, name: x.name, type: 'Tiền đổi đồ', img: x.img, emoji: x.icon, rank: x.id === 'sao_sang' ? 'S' : 'A', count: n(garden.shards[x.id]), have: `Đang có ${n(garden.shards[x.id])}`,
      desc: <>Đổi đồ đặc biệt ở Cửa hàng → Đổi sao, hoặc đổi ra lông chim (1 mảnh = <Feathers n={x.feathers} />).</>,
      source: `Nhận kèm khi gacha ra món hạng ${x.id === 'sao_sang' ? 'S' : 'A'}`,
    })),
  ]
  entries = byRank(entries, (e) => e.rank) // S → A → B
  const cur = entries.find((e) => e.key === sel) ?? entries[0]

  return (
    <SideTabScreen
      closeLabel="Đóng túi đồ"
      onClose={onClose}
      action={<Wallet garden={garden} />}
      tabs={TABS}
      tab={tab}
      setTab={(t) => { setTab(t); setSel(null) }}
      aside={cur ? <BagDetail e={cur} /> : <p className="p-4 text-sm leading-6 text-white/60">Chưa có gì để xem.</p>}
    >
      {entries.length === 0 ? <Empty>{BAG_EMPTY[tab]}</Empty> : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2.5 p-3">
          {entries.map((e) => <BagTile key={e.key} e={e} on={e.key === cur?.key} onClick={() => setSel(e.key)} />)}
        </div>
      )}
    </SideTabScreen>
  )
}

// ---- Cửa hàng: 4 tab [Hạt & phân] [Bùa] [Gacha] [Đổi sao]. KHÔNG có tiêu đề: thanh trên = nút đóng + tiền tệ (như màn hình Ước nguyện).
// Mỗi món là 1 Ô VUÔNG (ảnh + tên, nền kính màu theo hạng, giá ở ô dưới); chạm ô → BuyDialog (mô tả + chọn số lượng).
type ShopTab = 'seeds' | 'charms' | 'gacha' | 'stars'
const SHOP_TABS: SideTab<ShopTab>[] = [{ id: 'seeds', label: 'Hạt & phân', icon: '🫘' }, { id: 'charms', label: 'Bùa', icon: '🍀' }, { id: 'gacha', label: 'Gacha', icon: '🎲' }, { id: 'stars', label: 'Đổi sao', icon: '✨' }]

// Ảnh của món đổi được ở tab Đổi sao (bùa / phân bón / cục roll / côn trùng); hạt / chậu chọn loại giữ icon nét
function offerImg(o: Offer): string | undefined {
  if (o.give.charm) return charmById.get(o.give.charm)?.img
  if (o.give.fert) return fertById.get(o.give.fert.id)?.img
  if (o.give.vong_tinh) return ROLL_IMG.vong_tinh
  if (o.give.sao_duyen) return ROLL_IMG.sao_duyen
  if (o.choose === 'insect') return INSECTS[0]?.img
  if (o.choose === 'potS' || o.choose === 'potA') { const k = choicesOf(o.choose)[0]; return k ? potImage(k, 1) : undefined }
  if (o.choose === 'seedS' || o.choose === 'seedA') { const c = choicesOf(o.choose)[0]; return c ? seedImage(c) : undefined }
  return undefined
}
export const Shards = ({ id, n, className = '' }: { id: ShardId; n: number; className?: string }) => (
  <span className={`inline-flex items-center gap-0.5 align-middle tabular-nums ${className}`}>{n.toLocaleString('vi-VN')}<ItemImg img={shardById.get(id)!.img} emoji={shardById.get(id)!.icon} className="h-4 w-4" /></span>
)

// 1 món trong cửa hàng (dữ liệu cho ô vuông + dialog mua)
interface Good {
  key: string
  name: string
  img?: string
  emoji: string
  rank: ItemRank
  desc: ReactNode
  have?: number
  price: number
  pay: { img: string; name: string; have: number }
  max?: number // giới hạn còn lại (ngày / tháng)
  note?: string // nhãn góc trên ô (vd "Còn 2/5")
  block?: string // không mua được: lý do (ô mờ, chạm thì báo)
  ok?: string
  buy: (n: number) => Promise<string>
}

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3 p-3'
function ShopTile({ g, onClick }: { g: Good; onClick: () => void }) {
  return (
    <ItemTile img={g.img} emoji={g.emoji} name={g.name} rank={g.rank} tr={g.note} dim={!!g.block} onClick={onClick}
      footer={<TileFooter><img src={g.pay.img} alt={` ${g.pay.name}`} className="h-5 w-5 object-contain" /><span className={g.pay.have < g.price ? 'text-rose-300' : ''}>{g.price.toLocaleString('vi-VN')}</span></TileFooter>} />
  )
}

export function ShopPopup({ garden, actor, onClose, say }: { garden: Garden; actor: Actor; onClose: () => void; say: (m: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<ShopTab>('seeds')
  const [buying, setBuying] = useState<Good | null>(null)
  const [choosing, setChoosing] = useState<Offer | null>(null)
  const level = levelOf(garden.xp)
  const month = monthKey(), day = dayKey()
  const usedMonth = (id: string) => (garden.shop.month === month ? garden.shop.bought[id] ?? 0 : 0)
  const usedToday = (id: string) => (garden.shop.day === day ? garden.shop.today[id] ?? 0 : 0)

  async function job(fn: () => Promise<string>) {
    if (busy) return
    setBusy(true)
    try { const m = await fn(); if (m) say(m) } catch (err) { say(errorText(err)) } finally { setBusy(false) }
  }
  const exchange = (o: Offer, choice: string | null) => job(async () => `Đã đổi: ${await exchangeOffer(actor, o.id, choice)}`)

  const feathers = { img: FEATHER_IMG, name: 'lông chim', have: garden.feathers }
  const stones = { img: STONE_IMG, name: 'đá vũ trụ', have: garden.stones }
  const shardPay = (id: ShardId) => ({ img: shardById.get(id)!.img, name: shardById.get(id)!.name.toLowerCase(), have: garden.shards[id] })

  const seedGoods: Good[] = [
    ...FERTS.map((f): Good => {
      const left = f.dailyLimit === null ? undefined : f.dailyLimit - usedToday(`fert_${f.id}`)
      return {
        key: `fert${f.id}`, name: f.name, img: f.img, emoji: f.icon, rank: f.id, have: garden.ferts[f.id], price: f.price, pay: feathers,
        desc: <>Bón cây đang lớn (đã tưới): rút <b>{Math.round(f.cut * 100)}%</b> thời gian lớn. Mỗi cây bón tối đa 2 lần, tổng tối đa −60%.{left !== undefined && <> Mỗi ngày mua tối đa {f.dailyLimit} túi.</>}</>,
        max: left, note: left !== undefined ? `Hôm nay ${left}/${f.dailyLimit}` : undefined, block: left === 0 ? 'Hôm nay đã mua đủ, mai quay lại nhé' : undefined,
        buy: async (n) => `Đã mua ${n} túi ${f.name.toLowerCase()} · −${formatCoins(await buyFerts(actor, f.id, n))} lông chim`,
      }
    }),
    ...CROPS.filter((c) => c.rank === 'B').map((c): Good => ({
      key: `seed${c.id}`, name: `Hạt ${c.name.toLowerCase()}`, img: seedImage(c.id), emoji: c.icon, rank: c.rank, have: garden.seeds[c.id] ?? 0, price: c.seedPrice, pay: feathers,
      desc: <>Gieo vào chậu, lớn trong <b>{formatGrow(c.minutes)}</b>. Mỗi lần thu {c.yield} nông sản (tưới thêm 1), bán <Feathers n={c.sellPrice} /> / nông sản, +{c.xp} kinh nghiệm.</>,
      note: level < c.level ? `Cần cấp ${c.level}` : undefined, block: level < c.level ? `Cần cấp ${c.level} mới mua được hạt ${c.name.toLowerCase()}` : undefined,
      buy: async (n) => `Đã mua ${n} hạt ${c.name.toLowerCase()} · −${formatCoins(await buySeeds(actor, c.id, n))} lông chim`,
    })),
  ]
  const charmB = charmById.get('B')!
  const charmGoods: Good[] = [{
    key: 'charmB', name: charmB.name, img: charmB.img, emoji: charmB.icon, rank: 'B', have: garden.charms.B, price: CHARM_SHOP_PRICE, pay: feathers,
    desc: <>Tăng <b>+5%</b> tỉ lệ thành công khi đập chậu. Mỗi lần đập dùng tối đa 3 bùa may mắn.</>,
    buy: async (n) => `Đã mua ${n} ${charmB.name.toLowerCase()} · −${formatCoins(await buyCharms(actor, n))} lông chim`,
  }]
  const rollGoods: Good[] = (['vong_tinh', 'sao_duyen'] as const).map((id): Good => ({
    key: `roll${id}`, name: ROLL_INFO[id].name, img: ROLL_IMG[id], emoji: '⭐', rank: ROLL_INFO[id].rank, have: garden.rolls[id], price: ROLL_PRICE, pay: stones,
    desc: ROLL_INFO[id].desc,
    buy: async (n) => { await buyRolls(actor, id, n); return `Đã mua ${n} ${ROLL_INFO[id].name} · −${n * ROLL_PRICE} đá vũ trụ` },
  }))
  const offerHave = (o: Offer) =>
    o.give.charm ? garden.charms[o.give.charm] : o.give.fert ? garden.ferts[o.give.fert.id] : o.give.vong_tinh ? garden.rolls.vong_tinh : o.give.sao_duyen ? garden.rolls.sao_duyen : undefined
  const starGoods: Good[] = [
    ...OFFERS.filter(offerAvailable).map((o): Good => {
      const left = o.limit - usedMonth(o.id)
      return {
        key: o.id, name: o.name, img: offerImg(o), emoji: o.icon, rank: o.pay === 'sao_sang' ? 'S' : 'A', have: offerHave(o), price: o.price, pay: shardPay(o.pay),
        desc: <>Đổi bằng {shardById.get(o.pay)!.name.toLowerCase()}. Giới hạn {o.limit} lần mỗi tháng (làm mới đầu tháng).{o.choose && <> Bấm Đổi rồi chọn loại muốn nhận.</>}</>,
        max: o.choose ? Math.min(1, left) : left, note: `Còn ${left}/${o.limit}`, block: left <= 0 ? 'Tháng này đã đổi hết lượt' : undefined, ok: 'Đổi',
        buy: async (n) => {
          if (o.choose) { setChoosing(o); return '' }
          let msg = ''
          for (let i = 0; i < n; i++) msg = await exchangeOffer(actor, o.id, null)
          return `Đã đổi: ${msg}${n > 1 ? ` ×${n}` : ''}`
        },
      }
    }),
    ...SHARDS.map((s): Good => ({
      key: `sell${s.id}`, name: `${s.feathers} lông chim`, img: FEATHER_IMG, emoji: '🪶', rank: 'B', have: garden.feathers, price: 1, pay: shardPay(s.id), ok: 'Đổi',
      desc: <>Đổi 1 {s.name.toLowerCase()} lấy <Feathers n={s.feathers} />. Đổi 1 chiều, không giới hạn.</>,
      buy: async (n) => `Đã đổi ${n} ${s.name.toLowerCase()} · +${formatCoins(await sellShards(actor, s.id, n))} lông chim`,
    })),
    {
      key: 'stone', name: `${STONE_TO_FEATHERS} lông chim`, img: FEATHER_IMG, emoji: '🪶', rank: 'B', have: garden.feathers, price: 1, pay: stones, ok: 'Đổi',
      desc: <>Đổi 1 đá vũ trụ lấy <Feathers n={STONE_TO_FEATHERS} />. Đổi 1 chiều, không giới hạn.</>,
      buy: async (n) => `Đã đổi ${n} đá · +${formatCoins(await stonesToFeathers(actor, n))} lông chim`,
    },
  ]
  const goods = byRank(tab === 'seeds' ? seedGoods : tab === 'charms' ? charmGoods : tab === 'gacha' ? rollGoods : starGoods, (g) => g.rank) // S → A → B
  const foot = {
    seeds: 'Hạt hạng A / S không bán ở cửa hàng: nhận từ gacha hoặc đổi bằng mảnh vỡ sao. Bán nông sản trong Túi đồ để có thêm lông chim.',
    charms: 'Bùa may mắn A, S và bùa giữ cấp: rơi từ gacha, nhận qua thư, hoặc đổi bằng mảnh vỡ sao (tab Đổi sao).',
    gacha: 'Kiếm thêm đá vũ trụ khi lên cấp, làm nhiệm vụ hằng ngày và nhận thành tựu.',
    stars: 'Mảnh vỡ sao sáng / mảnh vỡ sao nhận KÈM khi gacha ra món hạng S / A.',
  }[tab]

  return (
    <SideTabScreen
      closeLabel="Đóng cửa hàng"
      onClose={onClose}
      action={<Wallet garden={garden} />}
      tabs={SHOP_TABS}
      tab={tab}
      setTab={setTab}
      overlay={
        <>
          {buying && (
            <BuyDialog
              name={buying.name} img={buying.img ?? FEATHER_IMG} rank={buying.rank} desc={buying.desc} have={buying.have}
              price={buying.price} payImg={buying.pay.img} payName={buying.pay.name} payHave={buying.pay.have} maxCount={buying.max} okLabel={buying.ok ?? 'Mua'}
              onClose={() => setBuying(null)}
              onConfirm={(n) => { const g = buying; setBuying(null); void job(() => g.buy(n)) }}
            />
          )}
          {choosing && choosing.choose && (
            <ChoosePicker offer={choosing} onClose={() => setChoosing(null)} onPick={(c) => { const o = choosing; setChoosing(null); void exchange(o, c) }} />
          )}
        </>
      }
    >
      <div className={GRID}>
        {goods.map((g) => <ShopTile key={g.key} g={g} onClick={() => (g.block ? say(g.block) : setBuying(g))} />)}
      </div>
      <p className="px-4 pb-3 text-xs leading-5 text-white/60">{foot}</p>
    </SideTabScreen>
  )
}

// Chọn loại (chậu / hạt / côn trùng) cho món đổi sao: dải cuộn ngang, chạm 1 ô để đổi luôn
function ChoosePicker({ offer, onClose, onPick }: { offer: Offer; onClose: () => void; onPick: (choice: string) => void }) {
  const items = choicesOf(offer.choose!)
  const label = (id: string) => potKindById.get(id)?.name ?? cropById.get(id)?.name ?? insectById.get(id)?.name ?? id
  const art = (id: string) => {
    if (potKindById.has(id)) return <img src={potImage(id, 1)} alt="" className="h-12 w-12 object-contain" />
    if (cropById.has(id)) return <img src={cropImage(id)} alt="" className="h-12 w-12 object-contain" />
    return <ItemImg img={insectById.get(id)?.img} emoji={insectById.get(id)?.icon ?? '🐛'} className="h-10 w-10" />
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
  'Côn trùng bay quanh cây: chạm để bắt (+2 kinh nghiệm), dùng để đập chậu (nâng cấp). Cây chín: chạm vào cây để thu hoạch.',
  'Phân bón: chạm cây đang lớn (đã tưới) → chọn phân B (−20%) / A (−40%) thời gian lớn, rồi kéo túi phân lướt qua cây khác để bón tiếp. Mỗi cây tối đa 2 lần, tổng tối đa −60%.',
  'Gacha ra món hạng S / A được KÈM mảnh vỡ sao sáng / mảnh vỡ sao: đổi đồ đặc biệt ở Cửa hàng → Đổi sao.',
  'Nhiệm vụ hằng ngày (nút 📝 trong menu ☰): 5 nhiệm vụ mỗi ngày, xong thì bấm nhận lông chim, đá vũ trụ, kinh nghiệm; xong cả 5 được thêm 2 Vọng Tinh + 2 Vọng Nguyệt.',
  'Đập chậu: nhấn giữ chậu → Đập, hoặc Túi đồ → Chậu → Đập. Có tỉ lệ thành công; bỏ thêm chậu trong kho / bùa may mắn để tăng tỉ lệ (nút ? giải thích chi tiết).',
  'Thu hoạch được kinh nghiệm để lên cấp, mở khoá cây mới và tầng mây mới. Bán nông sản trong Túi đồ để nhận lông chim.',
  'Dùng lông chim mua hạt giống ở Cửa hàng (nút xe đẩy góc phải trên).',
  'Hạt giống có hạng B (xanh biển), A (tím), S (vàng); hạt hạng A / S chỉ có từ gacha.',
]

// Cẩm nang: toàn màn hình như Thành tựu (SideTabScreen), 3 tab Cách chơi / Các loại cây / Cập nhật
type GuideTab = 'rules' | 'crops' | 'news'
const GUIDE_TABS: SideTab<GuideTab>[] = [{ id: 'rules', label: 'Cách chơi', icon: '📖' }, { id: 'crops', label: 'Các loại cây', icon: '🌱' }, { id: 'news', label: 'Cập nhật', icon: '✨' }]
export function GuidePopup({ garden, onClose }: { garden: Garden; onClose: () => void }) {
  const level = levelOf(garden.xp)
  const [tab, setTab] = useState<GuideTab>('rules')
  return (
    <SideTabScreen title="Cẩm nang" sub={`Bạn đang ở cấp ${level}`} closeLabel="Đóng cẩm nang" onClose={onClose} tabs={GUIDE_TABS} tab={tab} setTab={setTab}>
      {tab === 'rules' && (
        <ul className="list-disc space-y-1.5 py-3 pr-4 pl-8 text-sm leading-6 text-white/85">
          {RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      {tab === 'news' && <ChangelogList entries={CHANGELOG} />}
      {tab === 'crops' && CROPS.map((c) => (
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
    </SideTabScreen>
  )
}
