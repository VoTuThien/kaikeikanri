// Nhiệm vụ hằng ngày của game Vườn mây (xem CLAUDE.md "Nhiệm vụ hằng ngày"): popup RIÊNG (không gộp với Thành tựu).
// Mỗi ngày (làm mới 0 giờ theo giờ máy) bốc 5 nhiệm vụ KHÁC LOẠI, cố định theo ngày + người chơi; BẬC = số tầng đã mở (1–4).
// Tiến độ = bộ đếm `stats` hiện tại − ảnh chụp `daily.base` lúc bắt đầu ngày (chụp trong `mutate` trước mỗi lần ghi).
import { CROPS, cropById, levelOf } from './crops'
import { INSECTS, insectById } from './gacha'
import { dayKey } from './items'
import { TIER_COUNT, TIER_UNLOCK_LEVEL } from '../game/constants'

export interface DailyState {
  day: string // "YYYY-MM-DD" của ảnh chụp
  base: Record<string, number> // ảnh chụp `stats` lúc đầu ngày
  claimed: string[] // id nhiệm vụ đã nhận thưởng hôm nay ("bonus" = thưởng xong cả 5)
  quests: Quest[] // 5 nhiệm vụ của ngày, CHỐT lúc chụp (lên cấp giữa ngày không đổi nhiệm vụ)
}
export const EMPTY_DAILY: DailyState = { day: '', base: {}, claimed: [], quests: [] }

// Thưởng mỗi nhiệm vụ theo bậc (đã ×2 theo chốt 20/11/2026) + kinh nghiệm
export const DAILY_REWARD = [
  { feathers: 40, stones: 32, xp: 20 },
  { feathers: 50, stones: 32, xp: 40 },
  { feathers: 60, stones: 48, xp: 80 },
  { feathers: 80, stones: 64, xp: 150 },
]
export const DAILY_BONUS = { sao_duyen: 2 } // xong cả 5 nhiệm vụ trong ngày
export const DAILY_COUNT = 5

type Src = { xp: number; stats: Record<string, number> }
const st = (g: Src, k: string) => g.stats[k] ?? 0
const highCrops = () => CROPS.filter((c) => c.level >= 5)

// Các loại nhiệm vụ: `goals` theo bậc 1–4 (null = bậc đó không có); `param` = chỉ định (loại cây / côn trùng / tầng)
interface QuestType {
  id: string
  icon: string
  goals: (number | null)[]
  params?: (g: Src, rnd: () => number) => string | null // null = chưa bốc được (vd chưa có cây hạng cao)
  name: (goal: number, param: string | null) => string
  value: (g: Src, param: string | null) => number // giá trị bộ đếm tích luỹ
}
const pick = <T,>(arr: T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)]
const QUESTS: QuestType[] = [
  { id: 'sow', icon: '🫘', goals: [3, 6, 10, 15], name: (n) => `Gieo ${n} hạt giống`, value: (g) => st(g, 'sow') },
  { id: 'water', icon: '💧', goals: [3, 6, 10, 15], name: (n) => `Tưới cây ${n} lần`, value: (g) => st(g, 'water') },
  { id: 'harvest', icon: '🧺', goals: [5, 12, 20, 32], name: (n) => `Thu hoạch ${n} nông sản`, value: (g) => st(g, 'harvestItems') },
  {
    id: 'harvestCrop', icon: '🌿', goals: [2, 4, 6, 8],
    params: (g, rnd) => { const ok = CROPS.filter((c) => c.level <= levelOf(g.xp)); return ok.length ? pick(ok, rnd).id : null },
    name: (n, p) => `Thu hoạch ${cropById.get(p ?? '')?.name.toLowerCase() ?? 'cây'} ${n} lần`, value: (g, p) => st(g, `harvest_${p}`),
  },
  { id: 'sell', icon: '🛒', goals: [5, 12, 20, 35], name: (n) => `Bán ${n} nông sản`, value: (g) => st(g, 'sold') },
  { id: 'earn', icon: '🪙', goals: [40, 100, 200, 350], name: (n) => `Kiếm ${n} lông chim từ bán nông sản`, value: (g) => st(g, 'soldFeathers') },
  { id: 'catch', icon: '🐞', goals: [1, 3, 5, 8], name: (n) => `Bắt ${n} côn trùng`, value: (g) => st(g, 'catch') },
  {
    id: 'catchKind', icon: '🦋', goals: [1, 2, 3, 4], params: (_, rnd) => pick(INSECTS, rnd).id,
    name: (n, p) => `Bắt ${n} ${insectById.get(p ?? '')?.name.toLowerCase() ?? 'côn trùng'}`, value: (g, p) => st(g, `catch_${p}`),
  },
  {
    id: 'harvestTier', icon: '🏠', goals: [null, 4, 8, 12],
    params: (g, rnd) => { const open = Array.from({ length: TIER_COUNT }, (_, i) => i).filter((t) => levelOf(g.xp) >= TIER_UNLOCK_LEVEL[t]); return String(pick(open, rnd)) },
    name: (n, p) => `Thu hoạch ${n} lần ở tầng ${Number(p) + 1}`, value: (g, p) => st(g, `harvestTier_${p}`),
  },
  { id: 'upgrade', icon: '🪴', goals: [null, 1, 1, 2], name: (n) => `Đập chậu ${n} lần`, value: (g) => st(g, 'upgradeTry') },
  {
    id: 'harvestHigh', icon: '⭐', goals: [null, 2, 4, 6],
    params: (g) => (highCrops().some((c) => c.level <= levelOf(g.xp)) ? 'high' : null),
    name: (n) => `Thu hoạch ${n} lần cây hạng cao (mở từ cấp 5)`, value: (g) => highCrops().reduce((s, c) => s + st(g, `harvest_${c.id}`), 0),
  },
  { id: 'fertilize', icon: '🌱', goals: [3, 6, 10, 15], name: (n) => `Bón phân ${n} lần`, value: (g) => st(g, 'fertilize') },
  // "Chế tạo sản phẩm ở máy" (1 / 3 / 5 / 8): thêm khi có máy chế tạo (GĐ6)
]

// Bậc = số tầng đã mở (1–4)
export const dailyTier = (g: Src) => TIER_UNLOCK_LEVEL.filter((lv) => levelOf(g.xp) >= lv).length

// Số ngẫu nhiên có hạt giống (cố định theo ngày + người chơi)
function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
}

export interface Quest { id: string; type: string; icon: string; name: string; goal: number; param: string | null; tier: number }
// 5 nhiệm vụ của ngày `day` cho người chơi `uid` (bậc tính theo cấp lúc xem)
export function questsOf(uid: string, g: Src, day = dayKey()): Quest[] {
  const tier = dailyTier(g)
  const rnd = seeded(`${uid}|${day}`)
  const pool = QUESTS.filter((q) => q.goals[tier - 1] != null)
  const out: Quest[] = []
  while (out.length < DAILY_COUNT && pool.length) {
    const q = pool.splice(Math.floor(rnd() * pool.length), 1)[0]
    const param = q.params ? q.params(g, rnd) : null
    if (q.params && param === null) continue
    const goal = q.goals[tier - 1]!
    out.push({ id: q.id, type: q.id, icon: q.icon, name: q.name(goal, param), goal, param, tier })
  }
  return out
}

// Ảnh chụp đầu ngày: ngày mới thì chụp lại `stats` (gọi TRƯỚC khi cộng bộ đếm của thao tác)
export function rollDaily(daily: DailyState, uid: string, g: Src, day = dayKey()): DailyState {
  return daily.day === day ? daily : { day, base: { ...g.stats }, claimed: [], quests: questsOf(uid, g, day) }
}

// Tiến độ hôm nay của 1 nhiệm vụ (ngày chưa được chụp = 0, vì chưa có thao tác nào trong ngày)
export function questProgress(q: Quest, g: Src & { daily: DailyState }, day = dayKey()) {
  const t = QUESTS.find((x) => x.id === q.type)!
  if (g.daily.day !== day) return 0
  return Math.max(0, t.value(g, q.param) - t.value({ xp: g.xp, stats: g.daily.base }, q.param))
}
export interface QuestView { q: Quest; have: number; done: boolean; claimed: boolean }
export function dailyView(uid: string, g: Src & { daily: DailyState }, day = dayKey()) {
  const quests = g.daily.day === day && g.daily.quests.length ? g.daily.quests : questsOf(uid, g, day)
  const claimed = g.daily.day === day ? g.daily.claimed : []
  const rows: QuestView[] = quests.map((q) => { const have = questProgress(q, g, day); return { q, have, done: have >= q.goal, claimed: claimed.includes(q.id) } })
  const allClaimed = rows.length > 0 && rows.every((r) => r.claimed)
  const bonusClaimed = claimed.includes('bonus')
  const ready = rows.filter((r) => r.done && !r.claimed).length + (allClaimed && !bonusClaimed ? 1 : 0)
  return { rows, tier: quests[0]?.tier ?? dailyTier(g), allClaimed, bonusClaimed, ready }
}
