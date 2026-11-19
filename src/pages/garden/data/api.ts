import { doc, runTransaction, serverTimestamp, setDoc, type DocumentData } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { requireDb, type Actor } from '../../../lib/firestore'
import { cropById, EMPTY_PLOT, levelOf, MAX_PLOTS, plotPrice, plotState, START_COINS, START_PLOTS, type Plot } from './crops'
import { potKindById, potSetById, slotKey, STARTER_SETS, tierBlock, type OwnedPot } from './pots'
import { SLOTS } from '../game/slots'
import { bannerOf, EMPTY_GACHA, GIFT_ROLLS, TEST_GRANT, TESTER_UIDS, pullMany, ROLL_PRICE, START_STONES, type GachaState, type PullItem, type PullLog, type RollKind } from './gacha'
import { TIER_COUNT, TIER_UNLOCK_LEVEL } from '../game/constants'

// Vườn của mỗi thành viên: families/{familyId}/gardens/{uid}
// Cả gia đình xem được (sau này ghé vườn nhau), mỗi người chỉ sửa vườn của mình (firestore.rules).
// Xu trong game TÁCH RIÊNG hoàn toàn, không liên quan tới app Quỹ.
export interface Garden {
  name: string
  coins: number
  xp: number
  unlocked: number // số ô đất đã mở
  plots: Plot[] // luôn đủ MAX_PLOTS phần tử, ô từ `unlocked` trở đi là ô còn khoá
  barn: Record<string, number> // kho: id cây -> số nông sản
  harvested: number // tổng số nông sản đã thu hoạch
  pots: OwnedPot[] // mọi chậu người chơi có (đang đặt + trong kho)
  placed: Record<string, string> // chỗ đặt `${tầng}-${chỗ}` -> id chậu; tầng 1 (tầng 0 trong code): chỗ i ↔ ô đất plots[i]
  // ---- Gacha (xem data/gacha.ts) ----
  stones: number // đá vũ trụ
  rolls: Record<RollKind, number> // số cục roll đang có
  gift: boolean // đã nhận quà chào mừng (20 Vọng Tinh)
  seeds: Record<string, number> // hạt giống nhận từ gacha: id cây -> số hạt
  insects: Record<string, number> // côn trùng: id -> số con
  gacha: GachaState // bộ đếm banner chậu
  pullLog: PullLog[] // lịch sử quay (mới nhất cuối, tối đa PULL_LOG_MAX)
}
const PULL_LOG_MAX = 100

// Chậu ban đầu: đủ bộ Đất nung (6 chậu cấp 1), đặt ở các chỗ đầu của tầng 1 theo dáng mặc định của chỗ.
// Vườn cũ chưa có chậu: mỗi ô đất đã mở được 1 chậu (đúng dáng mặc định của chỗ), cộng thêm cho đủ bộ.
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
  const plots = ((d.plots ?? []) as Partial<Plot>[]).map((p) => ({ ...EMPTY_PLOT, ...p }))
  while (plots.length < MAX_PLOTS) plots.push({ ...EMPTY_PLOT })
  return {
    name: d.name ?? '',
    coins: d.coins ?? START_COINS,
    xp: d.xp ?? 0,
    unlocked: Math.min(MAX_PLOTS, d.unlocked ?? START_PLOTS),
    plots: plots.slice(0, MAX_PLOTS),
    barn: { ...(d.barn ?? {}) },
    harvested: d.harvested ?? 0,
    stones: d.stones ?? START_STONES,
    rolls: { sao_duyen: d.rolls?.sao_duyen ?? 0, vong_tinh: d.rolls?.vong_tinh ?? 0 },
    gift: d.gift ?? false,
    seeds: { ...(d.seeds ?? {}) },
    insects: { ...(d.insects ?? {}) },
    gacha: { ...EMPTY_GACHA, ...(d.gacha ?? {}) },
    pullLog: Array.isArray(d.pullLog) ? (d.pullLog as PullLog[]) : [],
    ...(Array.isArray(d.pots)
      ? { pots: withStarterSets((d.pots as OwnedPot[]).map((p) => ({ id: p.id, kind: p.kind, level: p.level ?? 1 }))), placed: { ...(d.placed ?? {}) } }
      : startPots(Math.min(MAX_PLOTS, d.unlocked ?? START_PLOTS))),
  }
}

// Lần đầu mở game: tạo vườn mới (6 ô đất, 100 xu)
export function createGarden(actor: Actor) {
  return setDoc(gardenDoc(actor.uid), {
    name: actor.name,
    coins: START_COINS,
    xp: 0,
    unlocked: START_PLOTS,
    plots: Array.from({ length: MAX_PLOTS }, () => ({ ...EMPTY_PLOT })),
    barn: {},
    harvested: 0,
    stones: START_STONES,
    rolls: { sao_duyen: 0, vong_tinh: 0 },
    gift: false,
    seeds: {},
    insects: {},
    gacha: EMPTY_GACHA,
    pullLog: [],
    ...startPots(START_PLOTS),
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

const usable = (g: Garden, index: number) => {
  if (index < 0 || index >= g.unlocked) throw new Error('Ô đất này chưa mở')
  return g.plots[index]
}

// Gieo hạt: trừ xu mua hạt
export function plant(actor: Actor, index: number, cropId: string) {
  return mutate(actor, (g) => {
    const crop = cropById.get(cropId)
    if (!crop) throw new Error('Không có loại cây này')
    if (usable(g, index).crop) throw new Error('Ô đất đã có cây')
    if (levelOf(g.xp) < crop.level) throw new Error(`Cần đạt cấp ${crop.level} để trồng ${crop.name}`)
    if (g.coins < crop.seedPrice) throw new Error('Không đủ xu mua hạt')
    g.coins -= crop.seedPrice
    g.plots[index] = { crop: crop.id, plantedAt: Date.now(), watered: false, bugCleared: false }
  })
}

// Chăm cây: tưới nước và / hoặc bắt sâu (chạm 1 ô làm hết việc đang cần)
export function tend(actor: Actor, index: number) {
  return mutate(actor, (g) => {
    const plot = usable(g, index)
    const st = plotState(plot, Date.now())
    if (!st) return
    if (st.thirsty) plot.watered = true
    if (st.hasBug) plot.bugCleared = true
  })
}

// Tưới + bắt sâu mọi cây đang cần. Trả về số ô đã chăm.
export function tendAll(actor: Actor) {
  return mutate(actor, (g) => {
    const now = Date.now()
    let n = 0
    g.plots.slice(0, g.unlocked).forEach((plot) => {
      const st = plotState(plot, now)
      if (!st || (!st.thirsty && !st.hasBug)) return
      if (st.thirsty) plot.watered = true
      if (st.hasBug) plot.bugCleared = true
      n++
    })
    return n
  })
}

// Thu hoạch các ô (đã chín) trong `indexes`: nông sản vào kho, cộng kinh nghiệm. Trả về số nông sản + cấp trước / sau.
function collect(g: Garden, indexes: number[]) {
  const now = Date.now()
  const before = levelOf(g.xp)
  let count = 0
  indexes.forEach((i) => {
    const plot = g.plots[i]
    const st = plotState(plot, now)
    if (!st?.ripe || !st.crop) return
    g.barn[st.crop.id] = (g.barn[st.crop.id] ?? 0) + st.harvest
    g.xp += st.crop.xp
    g.harvested += st.harvest
    count += st.harvest
    g.plots[i] = { ...EMPTY_PLOT }
  })
  return { count, before, after: levelOf(g.xp) }
}

export function harvest(actor: Actor, index: number) {
  return mutate(actor, (g) => {
    usable(g, index)
    return collect(g, [index])
  })
}

export function harvestAll(actor: Actor) {
  return mutate(actor, (g) => collect(g, Array.from({ length: g.unlocked }, (_, i) => i)))
}

// Bán nông sản trong kho (cropId = null: bán hết). Trả về số xu nhận được.
export function sell(actor: Actor, cropId: string | null) {
  return mutate(actor, (g) => {
    let coins = 0
    Object.entries(g.barn).forEach(([id, n]) => {
      if (cropId && id !== cropId) return
      const crop = cropById.get(id)
      if (crop && n > 0) coins += n * crop.sellPrice
      delete g.barn[id]
    })
    g.coins += coins
    return coins
  })
}

// Mở thêm ô đất (theo thứ tự)
export function buyPlot(actor: Actor) {
  return mutate(actor, (g) => {
    if (g.unlocked >= MAX_PLOTS) throw new Error('Đã mở hết ô đất')
    const price = plotPrice(g.unlocked)
    if (g.coins < price) throw new Error(`Cần ${price} xu để mở ô đất`)
    g.coins -= price
    g.unlocked += 1
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
    if (tier === 0) g.plots[slot] = { ...EMPTY_PLOT }
  })
}

// Dời chậu sang chỗ trống khác CÙNG TẦNG (tầng 1: cây trong chậu đi theo chậu)
export function movePot(actor: Actor, tier: number, from: number, to: number) {
  return mutate(actor, (g) => {
    checkSlot(g, tier, to)
    const id = g.placed[slotKey(tier, from)]
    if (!id) throw new Error('Không có chậu để dời')
    if (g.placed[slotKey(tier, to)]) throw new Error('Chỗ này đã có chậu')
    delete g.placed[slotKey(tier, from)]
    g.placed[slotKey(tier, to)] = id
    if (tier === 0) { g.plots[to] = g.plots[from]; g.plots[from] = { ...EMPTY_PLOT } }
  })
}

// Cất chậu vào kho: cây đang trồng trong chậu bị MẤT
export function storePot(actor: Actor, tier: number, slot: number) {
  return mutate(actor, (g) => {
    if (!g.placed[slotKey(tier, slot)]) throw new Error('Không có chậu để cất')
    delete g.placed[slotKey(tier, slot)]
    if (tier === 0) g.plots[slot] = { ...EMPTY_PLOT }
  })
}

// ---- Gacha ----
// Quà chào mừng: 20 Vọng Tinh (tạm nhận ngay trong màn hình gacha, sau này chuyển vào hòm thư)
export function claimGift(actor: Actor) {
  return mutate(actor, (g) => {
    if (g.gift) throw new Error('Bạn đã nhận quà chào mừng rồi')
    g.gift = true
    g.rolls.vong_tinh += GIFT_ROLLS
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
    return items
  })
}

// Lỗi từ transaction -> câu báo cho người chơi
export const errorText = (err: unknown) =>
  err instanceof Error && /[à-ỹ]/i.test(err.message) ? err.message : 'Thao tác thất bại. Vui lòng thử lại.'
