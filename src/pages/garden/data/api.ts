import { doc, runTransaction, serverTimestamp, setDoc, type DocumentData, type DocumentReference, type Transaction } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { requireDb, type Actor } from '../../../lib/firestore'
import { CATCH_XP, cropById, levelOf, plantState, START_COINS, START_FEATHERS, type Plant } from './crops'
import { POT_SETS, potKindById, potSetById, setsOnTier, slotKey, STARTER_SETS, tierBlock, type OwnedPot } from './pots'
import { SLOTS } from '../game/slots'
import { bannerOf, EMPTY_GACHA, insectById, pullMany, ROLL_PRICE, START_STONES, type GachaState, type PullItem, type PullLog, type RollKind } from './gacha'
import { TIER_COUNT, TIER_UNLOCK_LEVEL } from '../game/constants'
import { achievementById, achState, ACHIEVEMENTS, addReward, type Reward } from './achievements'
import { broadcastFor, broadcastsCol, mailCol, toMail, type MailRewards } from './mail'
import { dayKey, fertById, FERT_MIN_MINUTES, MAX_FERT_CUT, MAX_FERT_TIMES, monthKey, NO_FERTS, NO_SHARDS, shardById, STONE_TO_FEATHERS, type FertId, type Ferts, type ShardId, type Shards } from './items'
import { choicesOf, offerById } from './exchange'
import { DAILY_BONUS, DAILY_REWARD, dailyView, EMPTY_DAILY, rollDaily, type DailyState } from './daily'
import { CHARM_SHOP_PRICE, MAX_FODDER, MAX_LUCK, MAX_POT_LEVEL, NO_CHARMS, rollUpgrade, upgradeCost, upgradeRate, type Charms, type CharmId, type UpgradeOutcome } from './upgrade'

// Vườn của mỗi thành viên: families/{familyId}/gardens/{uid}
// Cả gia đình xem được (sau này ghé vườn nhau), mỗi người chỉ sửa vườn của mình (firestore.rules).
// Xu trong game TÁCH RIÊNG hoàn toàn, không liên quan tới app Quỹ.
export interface Garden {
  name: string
  coins: number // xu cũ (chỉ hiện ở menu Giải trí, game không dùng nữa)
  feathers: number // lông chim: tiền trong game (mua hạt, bán nông sản, sau này nâng cấp chậu)
  xp: number
  plants: Record<string, Plant> // cây trong chậu: chỗ đặt `${tầng}-${chỗ}` -> cây (chỗ đó phải có chậu)
  barn: Record<string, number> // kho: id cây -> số nông sản
  harvested: number // tổng số nông sản đã thu hoạch
  pots: OwnedPot[] // mọi chậu người chơi có (đang đặt + trong kho)
  placed: Record<string, string> // chỗ đặt `${tầng}-${chỗ}` -> id chậu
  // ---- Gacha (xem data/gacha.ts) ----
  stones: number // đá vũ trụ
  rolls: Record<RollKind, number> // số cục roll đang có
  gift: boolean // đã nhận quà chào mừng (20 Vọng Tinh)
  seeds: Record<string, number> // hạt giống (gacha / cửa hàng): id cây -> số hạt; gieo là trừ 1 hạt
  seedGift: boolean // đã nhận hạt tặng lúc bắt đầu (START_SEEDS)
  insects: Record<string, number> // côn trùng: id -> số con
  gacha: GachaState // bộ đếm banner chậu
  pullLog: PullLog[] // lịch sử quay (mới nhất cuối, tối đa PULL_LOG_MAX)
  stats: Stats // bộ đếm tích luỹ cho thành tựu (KHÔNG BAO GIỜ giảm)
  claimed: Record<string, number> // thành tựu: id -> số bậc đã nhận thưởng
  mailClaimed: Record<string, number> // thư chung (gardenBroadcasts) đã nhận: id -> lúc nhận (ms)
  born: number // lúc tạo vườn (ms, từ createdAt; CHỈ ĐỌC, không ghi lại)
  charms: Charms // bùa: may mắn B / A / S, giữ cấp (đập chậu)
  ferts: Ferts // phân bón B / A
  shards: Shards // mảnh vỡ sao sáng / mảnh vỡ sao
  shop: ShopLimit // đếm số lần mua / đổi có giới hạn
  daily: DailyState // nhiệm vụ hằng ngày (ảnh chụp bộ đếm đầu ngày + đã nhận)
}
// Giới hạn cửa hàng: `bought` = số lần đổi sao trong `month`, `today` = số túi phân A đã mua trong `day`
export interface ShopLimit { month: string; day: string; bought: Record<string, number>; today: Record<string, number> }
function shopNow(g: Garden) {
  const m = monthKey(), d = dayKey()
  if (g.shop.month !== m) g.shop = { ...g.shop, month: m, bought: {} }
  if (g.shop.day !== d) g.shop = { ...g.shop, day: d, today: {} }
  return g.shop
}

// ---- Bộ đếm tích luỹ (thành tựu, xem CLAUDE.md "Thành tựu") ----
// Mọi số chỉ tăng, cộng trong CÙNG transaction với thao tác. Khoá:
//   sow, water, harvestItems (số nông sản), harvest_<cây> (số LẦN thu hoạch loại đó), catch, catch_<loại>,
//   sold (số nông sản đã bán), soldFeathers, boughtSeeds, pulls, gold (số chậu S ra từ gacha),
//   pot_<loại chậu> = 1 (đã từng có), fullTier = 1 (từng đặt kín 1 tầng), fullSetTier = 1 (từng đặt đủ 1 bộ trên 1 tầng),
//   upgradeTry, upgradeOk (đập chậu), potLv6 = 1 (từng có chậu lv6), setLv6 = 1 (từng có cả 1 bộ lv6),
//   harvestTier_<tầng 0-3> (số LẦN thu hoạch ở tầng), fertilize (số lần bón), shardsEarned
export type Stats = Record<string, number>
export const bump = (g: Garden, key: string, n = 1) => { g.stats[key] = (g.stats[key] ?? 0) + n }
const flag = (g: Garden, key: string) => { g.stats[key] = 1 }
// Ghi "đã từng có" cho mọi loại chậu đang có
function markPots(g: Garden) {
  const best = new Map<string, number>()
  for (const p of g.pots) {
    if (!potKindById.has(p.kind)) continue
    flag(g, `pot_${p.kind}`)
    best.set(p.kind, Math.max(best.get(p.kind) ?? 0, p.level))
    if (p.level >= MAX_POT_LEVEL) flag(g, 'potLv6')
  }
  if (POT_SETS.some((set) => set.kinds.every((k) => (best.get(k) ?? 0) >= MAX_POT_LEVEL))) flag(g, 'setLv6')
}
// Sau khi đặt / dời chậu ở tầng: từng đặt kín tầng? từng đủ 1 bộ trên tầng?
function markTier(g: Garden, tier: number) {
  const keys = Object.keys(g.placed).filter((k) => k.startsWith(`${tier}-`))
  if (keys.length >= SLOTS[tier].length) flag(g, 'fullTier')
  const byId = new Map(g.pots.map((p) => [p.id, p]))
  const onTier = keys.map((k) => byId.get(g.placed[k])).filter((p): p is OwnedPot => !!p)
  if (setsOnTier(onTier).some((s) => s.full)) flag(g, 'fullSetTier')
}
const PULL_LOG_MAX = 100
// Hạt tặng lúc bắt đầu (chưa có cửa hàng): vườn nào chưa nhận thì được cộng 1 lần
const START_SEEDS: Record<string, number> = { cai: 10, carot: 10 }
const START_POTS = 6

// Chậu ban đầu: đủ bộ Đất nung (6 chậu cấp 1), đặt ở các chỗ đầu của tầng 1 theo dáng mặc định của chỗ.
// Vườn cũ (trước GĐ3) chưa có chậu: số ô đất đã mở cũ = số chậu được đặt sẵn.
function startPots(unlocked: number) {
  const pots: OwnedPot[] = []
  const placed: Record<string, string> = {}
  const take = (kind: string) => {
    const free = pots.find((p) => p.kind === kind && !Object.values(placed).includes(p.id))
    if (free) return free
    const p = { id: `p${pots.length + 1}`, kind, level: 1 }
    pots.push(p)
    return p
  }
  for (let i = 1; i <= 6; i++) take(`dat_nung_${i}`)
  SLOTS[0].slice(0, unlocked).forEach((s, i) => { placed[slotKey(0, i)] = take(`dat_nung_${s.shape}`).id })
  return { pots: withStarterSets(pots), placed }
}
// Tặng đủ các bộ chậu khởi đầu còn thiếu (bộ nào chưa có chậu nào thì thêm 6 chậu cấp 1)
function withStarterSets(pots: OwnedPot[]) {
  const out = [...pots]
  for (const id of STARTER_SETS) {
    const set = potSetById.get(id)
    if (!set || out.some((p) => potKindById.get(p.kind)?.set === id)) continue
    for (const kind of set.kinds) out.push({ id: `g_${kind}`, kind, level: 1 })
  }
  return out
}

export const gardensCol = () => familyCol('gardens')
export const gardenDoc = (uid: string) => doc(gardensCol(), uid)

export function toGarden(d: DocumentData): Garden {
  const seeds: Record<string, number> = { ...(d.seeds ?? {}) }
  if (!d.seedGift) for (const [k, n] of Object.entries(START_SEEDS)) seeds[k] = (seeds[k] ?? 0) + n
  const plants: Record<string, Plant> = {}
  for (const [k, p] of Object.entries((d.plants ?? {}) as Record<string, Partial<Plant>>)) {
    if (p?.crop && cropById.has(p.crop)) plants[k] = { crop: p.crop, plantedAt: p.plantedAt ?? 0, watered: !!p.watered, caught: !!p.caught, boost: p.boost ?? 0, fert: p.fert ?? 0 }
  }
  const potData = Array.isArray(d.pots)
    ? { pots: withStarterSets((d.pots as OwnedPot[]).map((p) => ({ id: p.id, kind: p.kind, level: p.level ?? 1 }))), placed: { ...(d.placed ?? {}) } as Record<string, string> }
    : startPots(Math.min(SLOTS[0].length, d.unlocked ?? START_POTS))
  for (const k of Object.keys(plants)) if (!potData.placed[k]) delete plants[k] // cây chỉ sống trong chậu
  const g: Garden = {
    name: d.name ?? '',
    coins: d.coins ?? START_COINS,
    feathers: d.feathers ?? START_FEATHERS,
    xp: d.xp ?? 0,
    plants,
    barn: { ...(d.barn ?? {}) },
    harvested: d.harvested ?? 0,
    stones: d.stones ?? START_STONES,
    rolls: { sao_duyen: d.rolls?.sao_duyen ?? 0, vong_tinh: d.rolls?.vong_tinh ?? 0 },
    gift: d.gift ?? false,
    seeds,
    seedGift: true,
    insects: { ...(d.insects ?? {}) },
    gacha: { ...EMPTY_GACHA, ...(d.gacha ?? {}) },
    pullLog: Array.isArray(d.pullLog) ? (d.pullLog as PullLog[]) : [],
    ...potData,
    stats: { ...(d.stats ?? {}) },
    claimed: { ...(d.claimed ?? {}) },
    mailClaimed: { ...(d.mailClaimed ?? {}) },
    charms: { ...NO_CHARMS, ...(d.charms ?? {}) },
    ferts: { ...NO_FERTS, ...(d.ferts ?? {}) },
    shards: { ...NO_SHARDS, ...(d.shards ?? {}) },
    shop: { month: '', day: '', bought: {}, today: {}, ...(d.shop ?? {}) },
    daily: { ...EMPTY_DAILY, ...(d.daily ?? {}) },
    born: typeof d.createdAt?.toMillis === 'function' ? d.createdAt.toMillis() : 0,
  }
  if (g.gift && !g.claimed.welcome) g.claimed.welcome = 1 // đã nhận quà chào mừng ở màn hình gacha cũ
  markPots(g)
  for (let t = 0; t < TIER_COUNT; t++) markTier(g, t)
  return g
}

// Lần đầu mở game: tạo vườn mới (6 chậu đất nung ở tầng 1, 100 xu, hạt tặng)
export function createGarden(actor: Actor) {
  return setDoc(gardenDoc(actor.uid), {
    name: actor.name,
    coins: START_COINS,
    feathers: START_FEATHERS,
    xp: 0,
    plants: {},
    barn: {},
    harvested: 0,
    stones: START_STONES,
    rolls: { sao_duyen: 0, vong_tinh: 0 },
    gift: false,
    seeds: { ...START_SEEDS },
    seedGift: true,
    insects: {},
    gacha: EMPTY_GACHA,
    pullLog: [],
    ...startPots(START_POTS),
    claimed: {},
    mailClaimed: {},
    charms: NO_CHARMS,
    ferts: NO_FERTS,
    shards: NO_SHARDS,
    shop: { month: '', day: '', bought: {}, today: {} },
    daily: EMPTY_DAILY,
    stats: Object.fromEntries([...new Set(startPots(START_POTS).pots.map((p) => p.kind))].map((k) => [`pot_${k}`, 1])),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// Đọc vườn mới nhất trong transaction, cho `change` sửa rồi ghi lại. `change` ném lỗi (chuỗi tiếng Việt) để báo người chơi.
async function mutate<T>(actor: Actor, change: (g: Garden) => T): Promise<T> {
  const ref = gardenDoc(actor.uid)
  return runTransaction(requireDb(), async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Không tìm thấy vườn')
    const g = toGarden(snap.data())
    g.daily = rollDaily(g.daily, actor.uid, g) // ngày mới: chụp bộ đếm TRƯỚC khi thao tác cộng thêm
    const result = change(g)
    writeGarden(tx, ref, g, actor)
    return result
  })
}
function writeGarden(tx: Transaction, ref: DocumentReference, g: Garden, actor: Actor) {
  const { born: _born, ...data } = g // `born` chỉ đọc từ createdAt
  void _born
  tx.update(ref, { ...data, name: actor.name, updatedAt: serverTimestamp() })
}

// ---- Cây trong chậu (GĐ4): gieo / tưới / thu hoạch / bắt côn trùng theo chỗ đặt chậu ----
function tierOpen(g: Garden, tier: number) {
  if (levelOf(g.xp) < TIER_UNLOCK_LEVEL[tier]) throw new Error(`Tầng ${tier + 1} mở khoá ở cấp ${TIER_UNLOCK_LEVEL[tier]}`)
}
function plantAt(g: Garden, tier: number, slot: number) {
  const p = g.plants[slotKey(tier, slot)]
  if (!p) throw new Error('Chậu này chưa có cây')
  return p
}

// Gieo hạt `cropId` vào các chậu trống `slots` của tầng (1 lần kéo túi hạt = 1 transaction). Mỗi chậu trừ 1 hạt.
// Chậu đã có cây / không có chậu thì bỏ qua; hết hạt thì dừng. Trả về số chậu đã gieo.
export function sow(actor: Actor, tier: number, slots: number[], cropId: string) {
  return mutate(actor, (g) => {
    const crop = cropById.get(cropId)
    if (!crop) throw new Error('Không có loại cây này')
    tierOpen(g, tier)
    if (levelOf(g.xp) < crop.level) throw new Error(`Cần đạt cấp ${crop.level} để trồng ${crop.name}`)
    const now = Date.now()
    let n = 0
    for (const slot of slots) {
      const key = slotKey(tier, slot)
      if (!g.placed[key] || g.plants[key]) continue
      if ((g.seeds[cropId] ?? 0) <= 0) break
      g.seeds[cropId] -= 1
      if (g.seeds[cropId] <= 0) delete g.seeds[cropId]
      g.plants[key] = { crop: cropId, plantedAt: now, watered: false, caught: false }
      n++
    }
    bump(g, 'sow', n)
    if (!n) throw new Error((g.seeds[cropId] ?? 0) <= 0 ? `Hết hạt ${crop.name.toLowerCase()}` : 'Không có chậu trống để gieo')
    return n
  })
}

// Tưới cây (trước khi chín: +1 nông sản)
export function water(actor: Actor, tier: number, slot: number) {
  return mutate(actor, (g) => {
    const p = plantAt(g, tier, slot)
    const st = plantState(p, Date.now())
    if (!st?.thirsty) throw new Error(st?.ripe ? 'Cây đã chín' : 'Cây đã được tưới')
    p.watered = true
    bump(g, 'water')
  })
}

// Bắt côn trùng đang ở trên cây → túi côn trùng, +CATCH_XP kinh nghiệm. Trả về id côn trùng + cấp trước / sau.
export function catchInsect(actor: Actor, tier: number, slot: number) {
  return mutate(actor, (g) => {
    const p = plantAt(g, tier, slot)
    const id = plantState(p, Date.now())?.insect
    if (!id) throw new Error('Côn trùng đã bay mất')
    p.caught = true
    g.insects[id] = (g.insects[id] ?? 0) + 1
    const before = levelOf(g.xp)
    g.xp += CATCH_XP
    bump(g, 'catch')
    bump(g, `catch_${id}`)
    return { id, xp: CATCH_XP, before, after: levelOf(g.xp) }
  })
}

// Thu hoạch cây đã chín: nông sản vào kho, cộng kinh nghiệm, chậu thành trống. Côn trùng chưa bắt thì bay mất.
export function harvestPlant(actor: Actor, tier: number, slot: number) {
  return mutate(actor, (g) => {
    const p = plantAt(g, tier, slot)
    const st = plantState(p, Date.now())
    if (!st?.ripe || !st.crop) throw new Error('Cây chưa chín')
    const before = levelOf(g.xp)
    g.barn[st.crop.id] = (g.barn[st.crop.id] ?? 0) + st.harvest
    g.xp += st.crop.xp
    g.harvested += st.harvest
    bump(g, 'harvestItems', st.harvest)
    bump(g, `harvestTier_${tier}`)
    bump(g, `harvest_${st.crop.id}`)
    delete g.plants[slotKey(tier, slot)]
    return { crop: st.crop.id, count: st.harvest, xp: st.crop.xp, before, after: levelOf(g.xp) }
  })
}

// Bán nông sản trong kho (cropId = null: bán hết). Trả về số lông chim nhận được.
export function sell(actor: Actor, cropId: string | null) {
  return mutate(actor, (g) => {
    let got = 0
    Object.entries(g.barn).forEach(([id, n]) => {
      if (cropId && id !== cropId) return
      const crop = cropById.get(id)
      if (crop && n > 0) { got += n * crop.sellPrice; bump(g, 'sold', n) }
      delete g.barn[id]
    })
    g.feathers += got
    bump(g, 'soldFeathers', got)
    return got
  })
}

// Cửa hàng: mua `n` hạt `cropId` bằng lông chim (chỉ hạt hạng B, đủ cấp mới mua được). Trả về số lông chim đã trả.
export function buySeeds(actor: Actor, cropId: string, n: number) {
  return mutate(actor, (g) => {
    const crop = cropById.get(cropId)
    if (!crop || crop.rank !== 'B') throw new Error('Cửa hàng không bán loại hạt này')
    if (!Number.isInteger(n) || n < 1) throw new Error('Số hạt không hợp lệ')
    if (levelOf(g.xp) < crop.level) throw new Error(`Cần đạt cấp ${crop.level} để mua hạt ${crop.name.toLowerCase()}`)
    const cost = crop.seedPrice * n
    if (g.feathers < cost) throw new Error(`Cần ${cost.toLocaleString('vi-VN')} lông chim, bạn đang có ${g.feathers.toLocaleString('vi-VN')}`)
    g.feathers -= cost
    g.seeds[cropId] = (g.seeds[cropId] ?? 0) + n
    bump(g, 'boughtSeeds', n)
    return cost
  })
}

// ---- Chậu: đặt / dời / cất vào kho (GĐ3) ----
function checkSlot(g: Garden, tier: number, slot: number) {
  if (tier < 0 || tier >= TIER_COUNT || slot < 0 || slot >= SLOTS[tier].length) throw new Error('Chỗ đặt không hợp lệ')
  if (levelOf(g.xp) < TIER_UNLOCK_LEVEL[tier]) throw new Error(`Tầng ${tier + 1} mở khoá ở cấp ${TIER_UNLOCK_LEVEL[tier]}`)
}
export const placedIds = (g: Garden) => new Set(Object.values(g.placed))

// Đặt 1 chậu trong kho vào chỗ trống
export function placePot(actor: Actor, tier: number, slot: number, potId: string) {
  return mutate(actor, (g) => {
    checkSlot(g, tier, slot)
    if (g.placed[slotKey(tier, slot)]) throw new Error('Chỗ này đã có chậu')
    const pot = g.pots.find((p) => p.id === potId)
    if (!pot || !potKindById.has(pot.kind)) throw new Error('Không tìm thấy chậu')
    if (placedIds(g).has(potId)) throw new Error('Chậu này đang được đặt ở chỗ khác')
    const block = tierBlock(potSetById.get(potKindById.get(pot.kind)!.set)!, tier)
    if (block) throw new Error(block)
    g.placed[slotKey(tier, slot)] = potId
    delete g.plants[slotKey(tier, slot)]
    markTier(g, tier)
  })
}

// Dời chậu sang chỗ trống khác CÙNG TẦNG (cây trong chậu đi theo chậu)
export function movePot(actor: Actor, tier: number, from: number, to: number) {
  return mutate(actor, (g) => {
    checkSlot(g, tier, to)
    const id = g.placed[slotKey(tier, from)]
    if (!id) throw new Error('Không có chậu để dời')
    if (g.placed[slotKey(tier, to)]) throw new Error('Chỗ này đã có chậu')
    delete g.placed[slotKey(tier, from)]
    g.placed[slotKey(tier, to)] = id
    const plant = g.plants[slotKey(tier, from)]
    delete g.plants[slotKey(tier, from)]
    if (plant) g.plants[slotKey(tier, to)] = plant
    markTier(g, tier)
  })
}

// Cất chậu vào kho: cây đang trồng trong chậu bị MẤT
export function storePot(actor: Actor, tier: number, slot: number) {
  return mutate(actor, (g) => {
    if (!g.placed[slotKey(tier, slot)]) throw new Error('Không có chậu để cất')
    delete g.placed[slotKey(tier, slot)]
    delete g.plants[slotKey(tier, slot)]
  })
}

// ---- Gacha ----
// ---- Thành tựu (xem data/achievements.ts) ----
function giveReward(g: Garden, r: Reward) {
  g.feathers += r.feathers ?? 0
  g.stones += r.stones ?? 0
  g.rolls.vong_tinh += r.vong_tinh ?? 0
  g.rolls.sao_duyen += r.sao_duyen ?? 0
}
// Nhận 1 bậc (bậc kế tiếp chưa nhận) của 1 thành tựu nếu đã đạt; tính lại từ dữ liệu server nên 2 máy không nhận trùng
function claimOne(g: Garden, id: string): Reward | null {
  const a = achievementById.get(id)
  if (!a) return null
  const s = achState(a, g, g.claimed)
  if (!s.ready) return null
  const r = a.reward(s.tier)
  giveReward(g, r)
  g.claimed[id] = s.tier + 1
  if (id === 'welcome') g.gift = true
  return r
}
export function claimAchievement(actor: Actor, id: string) {
  return mutate(actor, (g) => {
    const r = claimOne(g, id)
    if (!r) throw new Error('Chưa đạt thành tựu này hoặc đã nhận rồi')
    return r
  })
}
// Nhận mọi bậc đang chờ (của 1 nhóm, hoặc tất cả). Trả về tổng thưởng + số bậc đã nhận.
export function claimAllAchievements(actor: Actor, group: string | null) {
  return mutate(actor, (g) => {
    let sum: Reward = {}
    let n = 0
    for (const a of ACHIEVEMENTS) {
      if (group && a.group !== group) continue
      for (let r = claimOne(g, a.id); r; r = claimOne(g, a.id)) { sum = addReward(sum, r); n++ }
    }
    if (!n) throw new Error('Không có phần thưởng nào để nhận')
    return { sum, n }
  })
}
// Đổi đá vũ trụ lấy cục roll (16 đá / cục)
export function buyRolls(actor: Actor, kind: RollKind, n: number) {
  return mutate(actor, (g) => {
    const cost = n * ROLL_PRICE
    if (g.stones < cost) throw new Error(`Cần ${cost} đá vũ trụ để đổi ${n} cục`)
    g.stones -= cost
    g.rolls[kind] += n
  })
}
// Quay banner chậu: trừ Vọng Tinh, quay, ghi kết quả + lịch sử CÙNG 1 transaction (ghi xong mới phát hiệu ứng)
export function pullPots(actor: Actor, count: 1 | 10) {
  return mutate(actor, (g): PullItem[] => {
    if (g.rolls.vong_tinh < count) throw new Error(`Cần ${count} Vọng Tinh để quay`)
    g.rolls.vong_tinh -= count
    const items = pullMany(count, g.gacha, g, bannerOf().setId)
    for (const it of items) bump(g, 'shardsEarned', (it.shards?.sao_sang ?? 0) + (it.shards?.sao ?? 0))
    const at = Date.now()
    g.pullLog = [...g.pullLog, ...items.map((item) => ({ at, item }))].slice(-PULL_LOG_MAX)
    bump(g, 'pulls', count)
    bump(g, 'gold', items.filter((i) => i.type === 'pot' && i.rarity === 'gold').length)
    markPots(g)
    return items
  })
}

// ---- Đập chậu (xem data/upgrade.ts) ----
// Nâng 1 chậu (đang đặt hoặc trong kho): trừ côn trùng + lông chim + bùa, MẤT các chậu bỏ vào (chỉ lấy từ kho), quay tỉ lệ (tính lại từ dữ liệu server).
export function upgradePot(actor: Actor, potId: string, fodderIds: string[], luck: { B: number; A: number; S: number }, keep: boolean) {
  return mutate(actor, (g): { outcome: UpgradeOutcome; from: number; to: number; rate: number } => {
    const pot = g.pots.find((p) => p.id === potId)
    if (!pot || !potKindById.has(pot.kind)) throw new Error('Không tìm thấy chậu')
    if (pot.level >= MAX_POT_LEVEL) throw new Error('Chậu đã đạt cấp tối đa')
    const ids = [...new Set(fodderIds)]
    if (ids.length > MAX_FODDER) throw new Error(`Chỉ bỏ vào tối đa ${MAX_FODDER} chậu`)
    const placedNow = placedIds(g)
    const fodder = ids.map((id) => {
      const f = g.pots.find((p) => p.id === id)
      if (!f || id === potId) throw new Error('Chậu bỏ vào không hợp lệ')
      if (placedNow.has(id)) throw new Error('Chậu bỏ vào phải ở trong kho (cất chậu đang đặt trước)')
      return f
    })
    for (const k of ['B', 'A', 'S'] as const) if (!Number.isInteger(luck[k]) || luck[k] < 0 || luck[k] > g.charms[k]) throw new Error('Không đủ bùa may mắn')
    if (luck.B + luck.A + luck.S > MAX_LUCK) throw new Error(`Chỉ dùng tối đa ${MAX_LUCK} bùa may mắn`)
    if (keep && g.charms.keep < 1) throw new Error('Không có bùa giữ cấp')
    const cost = upgradeCost(pot)
    for (const [id, n] of Object.entries(cost.insects)) if ((g.insects[id] ?? 0) < n) throw new Error(`Thiếu ${insectById.get(id)?.name.toLowerCase() ?? 'côn trùng'}: cần ${n}, đang có ${g.insects[id] ?? 0}`)
    if (g.feathers < cost.feathers) throw new Error(`Cần ${cost.feathers} lông chim, bạn đang có ${g.feathers}`)
    // trừ đồ
    for (const [id, n] of Object.entries(cost.insects)) { g.insects[id] -= n; if (g.insects[id] <= 0) delete g.insects[id] }
    g.feathers -= cost.feathers
    for (const k of ['B', 'A', 'S'] as const) g.charms[k] -= luck[k]
    if (keep) g.charms.keep -= 1
    const rate = upgradeRate(pot, fodder, luck).total
    const gone = new Set(ids)
    g.pots = g.pots.filter((p) => !gone.has(p.id))
    // quay
    const from = pot.level
    const r = rollUpgrade(from, rate, keep)
    pot.level = r.level
    bump(g, 'upgradeTry')
    if (r.outcome === 'up') bump(g, 'upgradeOk')
    markPots(g)
    return { outcome: r.outcome, from, to: r.level, rate }
  })
}
// Cửa hàng: mua bùa may mắn B bằng lông chim
export function buyCharms(actor: Actor, n: number) {
  return mutate(actor, (g) => {
    if (!Number.isInteger(n) || n < 1) throw new Error('Số bùa không hợp lệ')
    const cost = CHARM_SHOP_PRICE * n
    if (g.feathers < cost) throw new Error(`Cần ${cost} lông chim, bạn đang có ${g.feathers}`)
    g.feathers -= cost
    g.charms.B += n
    return cost
  })
}

// ---- Phân bón (xem data/items.ts) ----
// Bón 1 loại phân cho các cây chưa chín `slots` của tầng (1 lần kéo túi phân = 1 transaction). Mỗi cây tối đa MAX_FERT_TIMES lần, tổng rút tối đa MAX_FERT_CUT.
// Cây không bón được (chín / đã đủ lần / đã đủ 60% / cây quá ngắn) thì bỏ qua; hết phân thì dừng. Trả về số cây đã bón + tổng thời gian rút (ms).
export function fertilize(actor: Actor, tier: number, slots: number[], fertId: FertId) {
  return mutate(actor, (g) => {
    const f = fertById.get(fertId)
    if (!f) throw new Error('Không có loại phân này')
    const now = Date.now()
    let n = 0
    let cutMs = 0
    for (const slot of slots) {
      const p = g.plants[slotKey(tier, slot)]
      if (!p) continue
      const st = plantState(p, now)
      if (!st?.crop || st.ripe || (p.fert ?? 0) >= MAX_FERT_TIMES || (p.boost ?? 0) >= MAX_FERT_CUT || st.crop.minutes < FERT_MIN_MINUTES) continue
      if (g.ferts[fertId] <= 0) break
      g.ferts[fertId] -= 1
      const add = Math.min(f.cut, MAX_FERT_CUT - (p.boost ?? 0))
      p.boost = (p.boost ?? 0) + add
      p.fert = (p.fert ?? 0) + 1
      cutMs += Math.min(add, 1 - st.progress) * st.crop.minutes * 60_000
      n++
    }
    if (!n) throw new Error(g.ferts[fertId] <= 0 ? `Hết ${f.name.toLowerCase()}` : 'Không có cây nào bón được (đã chín / đã bón đủ 2 lần)')
    bump(g, 'fertilize', n)
    return { n, cutMs }
  })
}
// Cửa hàng: mua phân bón bằng lông chim (phân A tối đa dailyLimit túi / ngày)
export function buyFerts(actor: Actor, fertId: FertId, n: number) {
  return mutate(actor, (g) => {
    const f = fertById.get(fertId)
    if (!f || !Number.isInteger(n) || n < 1) throw new Error('Số túi không hợp lệ')
    const shop = shopNow(g)
    const used = shop.today[`fert_${fertId}`] ?? 0
    if (f.dailyLimit !== null && used + n > f.dailyLimit) throw new Error(`${f.name} chỉ mua tối đa ${f.dailyLimit} túi / ngày (hôm nay còn ${Math.max(0, f.dailyLimit - used)})`)
    const cost = f.price * n
    if (g.feathers < cost) throw new Error(`Cần ${cost} lông chim, bạn đang có ${g.feathers}`)
    g.feathers -= cost
    g.ferts[fertId] += n
    shop.today[`fert_${fertId}`] = used + n
    return cost
  })
}

// ---- Đổi sao (xem data/exchange.ts) ----
export function exchangeOffer(actor: Actor, offerId: string, choice: string | null) {
  return mutate(actor, (g) => {
    const o = offerById.get(offerId)
    if (!o) throw new Error('Không có món này')
    const shop = shopNow(g)
    const used = shop.bought[o.id] ?? 0
    if (used >= o.limit) throw new Error(`Tháng này đã đổi đủ ${o.limit} lần`)
    if (o.choose && (!choice || !choicesOf(o.choose).includes(choice))) throw new Error('Hãy chọn loại muốn đổi')
    if (g.shards[o.pay] < o.price) throw new Error(`Cần ${o.price} ${shardById.get(o.pay)!.name.toLowerCase()}, bạn đang có ${g.shards[o.pay]}`)
    g.shards[o.pay] -= o.price
    const v = o.give
    if (v.vong_tinh) g.rolls.vong_tinh += v.vong_tinh
    if (v.sao_duyen) g.rolls.sao_duyen += v.sao_duyen
    if (v.charm) g.charms[v.charm] += 1
    if (v.fert) g.ferts[v.fert.id] += v.fert.qty
    if (v.seeds && choice) g.seeds[choice] = (g.seeds[choice] ?? 0) + v.seeds
    if (v.insects && choice) g.insects[choice] = (g.insects[choice] ?? 0) + v.insects
    if (v.pot && choice) { g.pots.push({ id: `x${Date.now().toString(36)}${g.pots.length}`, kind: choice, level: 1 }); markPots(g) }
    shop.bought[o.id] = used + 1
    return o.name
  })
}
// Đổi ngược mảnh vỡ sao → lông chim (1 chiều, không giới hạn)
export function sellShards(actor: Actor, id: ShardId, n: number) {
  return mutate(actor, (g) => {
    const s = shardById.get(id)
    if (!s || !Number.isInteger(n) || n < 1) throw new Error('Số mảnh không hợp lệ')
    if (g.shards[id] < n) throw new Error(`Bạn chỉ có ${g.shards[id]} ${s.name.toLowerCase()}`)
    g.shards[id] -= n
    g.feathers += n * s.feathers
    return n * s.feathers
  })
}
// Đổi đá vũ trụ → lông chim (1 đá = 5 lông chim, 1 chiều)
export function stonesToFeathers(actor: Actor, n: number) {
  return mutate(actor, (g) => {
    if (!Number.isInteger(n) || n < 1) throw new Error('Số đá không hợp lệ')
    if (g.stones < n) throw new Error(`Bạn chỉ có ${g.stones} đá vũ trụ`)
    g.stones -= n
    g.feathers += n * STONE_TO_FEATHERS
    return n * STONE_TO_FEATHERS
  })
}

// ---- Nhiệm vụ hằng ngày (xem data/daily.ts) ----
// Nhận thưởng 1 nhiệm vụ (`id`), thưởng xong cả 5 ("bonus"), hoặc mọi thứ đang chờ (`id` = null). Trả về tổng thưởng + cấp trước / sau.
export function claimDaily(actor: Actor, id: string | null) {
  return mutate(actor, (g) => {
    const v = dailyView(actor.uid, g)
    const sum = { feathers: 0, stones: 0, xp: 0, sao_duyen: 0 }
    const before = levelOf(g.xp)
    let n = 0
    for (const r of v.rows) {
      if ((id && id !== r.q.id) || !r.done || r.claimed) continue
      const rw = DAILY_REWARD[r.q.tier - 1]
      g.feathers += rw.feathers; g.stones += rw.stones; g.xp += rw.xp
      sum.feathers += rw.feathers; sum.stones += rw.stones; sum.xp += rw.xp
      g.daily.claimed.push(r.q.id)
      n++
    }
    const allNow = v.rows.length > 0 && v.rows.every((r) => g.daily.claimed.includes(r.q.id))
    if ((id === null || id === 'bonus') && allNow && !g.daily.claimed.includes('bonus')) {
      g.rolls.sao_duyen += DAILY_BONUS.sao_duyen
      sum.sao_duyen += DAILY_BONUS.sao_duyen
      g.daily.claimed.push('bonus')
      bump(g, 'fullDays')
      n++
    }
    if (!n) throw new Error('Chưa có phần thưởng nào để nhận')
    return { ...sum, n, before, after: levelOf(g.xp) }
  })
}

// ---- Hòm thư (xem data/mail.ts) ----
// Cộng quà của 1 thư vào vườn (bỏ qua cây / côn trùng / chậu không còn trong game)
function giveMail(g: Garden, r: MailRewards, mailId: string) {
  giveReward(g, r)
  for (const [k, n] of Object.entries(r.seeds ?? {})) if (cropById.has(k) && n > 0) g.seeds[k] = (g.seeds[k] ?? 0) + n
  for (const [k, n] of Object.entries(r.insects ?? {})) if (insectById.has(k) && n > 0) g.insects[k] = (g.insects[k] ?? 0) + n
  for (const [k, n] of Object.entries(r.ferts ?? {})) if (k in NO_FERTS && n > 0) g.ferts[k as FertId] += n
  for (const [k, n] of Object.entries(r.shards ?? {})) if (k in NO_SHARDS && n > 0) g.shards[k as ShardId] += n
  for (const [k, n] of Object.entries(r.charms ?? {})) if (k in NO_CHARMS && n > 0) g.charms[k as CharmId] += n
  ;(r.pots ?? []).forEach((kind, i) => { if (potKindById.has(kind)) g.pots.push({ id: `m${mailId}_${i}`, kind, level: 1 }) })
  markPots(g)
}
// Nhận quà các thư (1 transaction): thư riêng ghi `claimedAt`, thư chung ghi `mailClaimed` của vườn.
// Thư đã nhận / hết hạn / không dành cho vườn này thì bỏ qua. Trả về số thư đã nhận.
export function claimMails(actor: Actor, mails: { id: string; broadcast: boolean }[]) {
  const ref = gardenDoc(actor.uid)
  return runTransaction(requireDb(), async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Không tìm thấy vườn')
    const g = toGarden(snap.data())
    const snaps = await Promise.all(mails.map((m) => tx.get(doc(m.broadcast ? broadcastsCol() : mailCol(actor.uid), m.id))))
    const now = Date.now()
    let n = 0
    snaps.forEach((s, i) => {
      if (!s.exists()) return
      const m = toMail(s.id, s.data(), mails[i].broadcast)
      if (m.expiresAt && m.expiresAt <= now) return
      if (m.broadcast) {
        if (g.mailClaimed[m.id] || !broadcastFor(m, g.born)) return
        g.mailClaimed[m.id] = now
      } else {
        if (m.claimedAt) return
        tx.update(s.ref, { claimedAt: serverTimestamp() })
      }
      giveMail(g, m.rewards, m.id)
      n++
    })
    if (!n) throw new Error('Thư đã nhận rồi hoặc đã hết hạn')
    writeGarden(tx, ref, g, actor)
    return n
  })
}

// Lỗi từ transaction -> câu báo cho người chơi
export const errorText = (err: unknown) =>
  err instanceof Error && /[à-ỹ]/i.test(err.message) ? err.message : 'Thao tác thất bại. Vui lòng thử lại.'
