import { doc, runTransaction, serverTimestamp, setDoc, type DocumentData } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { requireDb, type Actor } from '../../../lib/firestore'
import { cropById, EMPTY_PLOT, levelOf, MAX_PLOTS, plotPrice, plotState, START_COINS, START_PLOTS, type Plot } from './crops'

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

// Lỗi từ transaction -> câu báo cho người chơi
export const errorText = (err: unknown) =>
  err instanceof Error && /[à-ỹ]/i.test(err.message) ? err.message : 'Thao tác thất bại. Vui lòng thử lại.'
