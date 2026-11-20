import { doc, runTransaction, serverTimestamp, setDoc, type DocumentData } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { requireDb, type Actor } from '../../../lib/firestore'
import { CATCH_XP, cropById, levelOf, plantState, START_COINS, START_FEATHERS, type Plant } from './crops'
import { potKindById, potSetById, setsOnTier, slotKey, STARTER_SETS, tierBlock, type OwnedPot } from './pots'
import { SLOTS } from '../game/slots'
import { bannerOf, EMPTY_GACHA, TEST_GRANT, TESTER_UIDS, pullMany, ROLL_PRICE, START_STONES, type GachaState, type PullItem, type PullLog, type RollKind } from './gacha'
import { TIER_COUNT, TIER_UNLOCK_LEVEL } from '../game/constants'
import { achievementById, achState, ACHIEVEMENTS, addReward, type Reward } from './achievements'

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
}

// ---- Bộ đếm tích luỹ (thành tựu, xem CLAUDE.md "Thành tựu") ----
// Mọi số chỉ tăng, cộng trong CÙNG transaction với thao tác. Khoá:
//   sow, water, harvestItems (số nông sản), harvest_<cây> (số LẦN thu hoạch loại đó), catch, catch_<loại>,
//   sold (số nông sản đã bán), soldFeathers, boughtSeeds, pulls, gold (số chậu S ra từ gacha),
//   pot_<loại chậu> = 1 (đã từng có), fullTier = 1 (từng đặt kín 1 tầng), fullSetTier = 1 (từng đặt đủ 1 bộ trên 1 tầng)
export type Stats = Record<string, number>
export const bump = (g: Garden, key: string, n = 1) => { g.stats[key] = (g.stats[key] ?? 0) + n }
const flag = (g: Garden, key: string) => { g.stats[key] = 1 }
// Ghi "đã từng có" cho mọi loại chậu đang có
function markPots(g: Garden) { for (const p of g.pots) if (potKindById.has(p.kind)) flag(g, `pot_${p.kind}`) }
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
    if (p?.crop && cropById.has(p.crop)) plants[k] = { crop: p.crop, plantedAt: p.plantedAt ?? 0, watered: !!p.watered, caught: !!p.caught }
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
    const result = change(g)
    tx.update(ref, { ...g, name: actor.name, updatedAt: serverTimestamp() })
    return result
  })
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
// TẠM để test: tài khoản trong TESTER_UIDS nhận thêm Vọng Tinh
export function grantTestRolls(actor: Actor) {
  return mutate(actor, (g) => {
    if (!TESTER_UIDS.includes(actor.uid)) throw new Error('Tài khoản này không dùng được chức năng test')
    g.rolls.vong_tinh += TEST_GRANT
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
    const items = pullMany(count, g.gacha, g.pots, g.seeds, g.insects, bannerOf().setId)
    const at = Date.now()
    g.pullLog = [...g.pullLog, ...items.map((item) => ({ at, item }))].slice(-PULL_LOG_MAX)
    bump(g, 'pulls', count)
    bump(g, 'gold', items.filter((i) => i.type === 'pot' && i.rarity === 'gold').length)
    markPots(g)
    return items
  })
}

// Lỗi từ transaction -> câu báo cho người chơi
export const errorText = (err: unknown) =>
  err instanceof Error && /[à-ỹ]/i.test(err.message) ? err.message : 'Thao tác thất bại. Vui lòng thử lại.'
