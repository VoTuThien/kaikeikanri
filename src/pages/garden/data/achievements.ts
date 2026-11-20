// Thành tựu của game Vườn mây (xem CLAUDE.md "Thành tựu"): định nghĩa, tiến độ (đọc từ bộ đếm `stats` của vườn) và phần thưởng.
// Mỗi thành tựu có nhiều BẬC (`goals`, tăng dần); `claimed[id]` = số bậc đã nhận. Bậc mới chỉ được THÊM VÀO CUỐI `goals`
// (không đổi / chèn bậc cũ) để số bậc đã nhận của người chơi vẫn đúng.
import { CROPS, levelOf, MAX_LEVEL } from './crops'
import { GIFT_ROLLS, INSECTS } from './gacha'
import { POT_SETS, potKindById, potSetById, type Rank } from './pots'

export interface Reward { feathers?: number; stones?: number; vong_tinh?: number; sao_duyen?: number }

// Thưởng theo bậc I–VII (đã ×2 theo chốt 20/11/2026; bậc V–VII kèm cục roll)
export const TIER_REWARD: Reward[] = [
  { feathers: 40, stones: 16 },
  { feathers: 80, stones: 32 },
  { feathers: 160, stones: 48 },
  { feathers: 300, stones: 64 },
  { feathers: 600, stones: 96, vong_tinh: 2 },
  { feathers: 1000, stones: 128, vong_tinh: 4, sao_duyen: 2 },
  { feathers: 1600, stones: 160, vong_tinh: 6, sao_duyen: 4 },
]
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

// Quà chào mừng (thay cho nút nhận quà ở màn hình gacha)
export const WELCOME_REWARD: Reward = { vong_tinh: GIFT_ROLLS }

// Thưởng lên cấp L: cấp 5 / 10 / 15 (mở tầng) và các mốc 20…90 THAY CHO thưởng cấp thường
const LEVEL_MILESTONE: Record<number, Reward> = {
  5: { stones: 160, feathers: 200, vong_tinh: 30, sao_duyen: 20 },
  10: { stones: 160, feathers: 200, vong_tinh: 30, sao_duyen: 20 },
  15: { stones: 160, feathers: 200, vong_tinh: 30, sao_duyen: 20 },
  20: { stones: 200, feathers: 400, vong_tinh: 35, sao_duyen: 25 },
  30: { stones: 240, feathers: 600, vong_tinh: 40, sao_duyen: 30 },
  40: { stones: 280, feathers: 800, vong_tinh: 45, sao_duyen: 35 },
  50: { stones: 320, feathers: 1000, vong_tinh: 50, sao_duyen: 40 },
  60: { stones: 360, feathers: 1200, vong_tinh: 55, sao_duyen: 45 },
  70: { stones: 400, feathers: 1400, vong_tinh: 60, sao_duyen: 50 },
  80: { stones: 440, feathers: 1600, vong_tinh: 65, sao_duyen: 55 },
  90: { stones: 480, feathers: 2000, vong_tinh: 80, sao_duyen: 70 },
}
export const levelReward = (L: number): Reward => LEVEL_MILESTONE[L] ?? { stones: 16, feathers: 10 * L, vong_tinh: 10, sao_duyen: 5 }

export type GroupId = 'thang_tien' | 'thu_hoach' | 'thu_thap' | 'cham_soc' | 'buon_ban' | 'uoc_nguyen'
export const GROUPS: { id: GroupId; name: string; icon: string }[] = [
  { id: 'thang_tien', name: 'Thăng tiến', icon: '⭐' },
  { id: 'thu_hoach', name: 'Thu hoạch', icon: '🧺' },
  { id: 'thu_thap', name: 'Thu thập', icon: '🪴' },
  { id: 'cham_soc', name: 'Chăm sóc', icon: '💧' },
  { id: 'buon_ban', name: 'Buôn bán', icon: '🛒' },
  { id: 'uoc_nguyen', name: 'Ước nguyện', icon: '🎁' },
]

// Dữ liệu vườn mà thành tựu cần (tránh import vòng với api.ts)
export interface AchSource { xp: number; stats: Record<string, number> }

export interface Achievement {
  id: string
  group: GroupId
  icon: string
  img?: string // ảnh thay icon nét (vd thành tựu bắt từng loại côn trùng)
  name: (tier: number) => string // tên ở bậc `tier` (0 = bậc đầu)
  desc: (goal: number) => string
  goals: number[]
  reward: (tier: number) => Reward
  progress: (g: AchSource) => number
  roman?: boolean // ghi số La Mã sau tên (thành tựu nhiều bậc)
  show?: (g: AchSource) => boolean // ẩn khi chưa liên quan (vd cây chưa đủ cấp trồng)
}

const st = (g: AchSource, k: string) => g.stats[k] ?? 0
const countKeys = (g: AchSource, prefix: string, skip: string[] = []) =>
  Object.entries(g.stats).filter(([k, v]) => k.startsWith(prefix) && !skip.includes(k) && v > 0).length
const fmt = (n: number) => n.toLocaleString('vi-VN')
const tiers = (from: number) => (i: number) => TIER_REWARD[Math.min(6, from + i)]
const one = (tierIdx: number) => () => TIER_REWARD[tierIdx]
const potRankOwned = (g: AchSource, rank: Rank) =>
  Object.keys(g.stats).some((k) => k.startsWith('pot_') && potSetById.get(potKindById.get(k.slice(4))?.set ?? '')?.rank === rank) ? 1 : 0
const SET_TIER: Record<Rank, number> = { B: 2, A: 4, S: 6 } // Trọn bộ: hạng B = thưởng bậc III, A = bậc V, S = bậc VII

function build(): Achievement[] {
  const list: Achievement[] = []
  const many = (a: Omit<Achievement, 'reward' | 'roman'> & { from?: number }) => list.push({ ...a, roman: true, reward: tiers(a.from ?? 0) })

  // ---- Thăng tiến ----
  list.push({ id: 'welcome', group: 'thang_tien', icon: '🎁', name: () => 'Chào mừng tới Vườn mây', desc: () => 'Quà chào mừng người chơi mới', goals: [1], reward: () => WELCOME_REWARD, progress: () => 1 })
  list.push({
    id: 'level', group: 'thang_tien', icon: '⭐',
    name: (t) => `Lên cấp ${t + 2}`, desc: (goal) => `Đạt cấp ${goal}`,
    goals: Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 2),
    reward: (t) => levelReward(t + 2), progress: (g) => levelOf(g.xp),
  })

  // ---- Thu hoạch ----
  many({ id: 'harvest', group: 'thu_hoach', icon: '🧺', name: () => 'Nông dân chăm chỉ', desc: (n) => `Thu hoạch tổng ${fmt(n)} nông sản`, goals: [50, 200, 500, 1000, 2500, 5000, 10000], progress: (g) => st(g, 'harvestItems') })
  for (const c of CROPS) {
    many({ id: `master_${c.id}`, group: 'thu_hoach', icon: c.icon, name: () => `Bậc thầy ${c.name.toLowerCase()}`, desc: (n) => `Thu hoạch ${c.name.toLowerCase()} ${fmt(n)} lần`, goals: [10, 50, 200], progress: (g) => st(g, `harvest_${c.id}`), show: (g) => levelOf(g.xp) >= c.level || st(g, `harvest_${c.id}`) > 0 })
  }
  many({ id: 'variety', group: 'thu_hoach', icon: '🌿', name: () => 'Vườn đa dạng', desc: (n) => `Thu hoạch ${n} loại cây khác nhau`, goals: [4, 8, 16, 22].filter((n) => n <= CROPS.length), progress: (g) => countKeys(g, 'harvest_') })
  if (CROPS.some((c) => c.rank === 'A')) list.push({ id: 'crop_A', group: 'thu_hoach', icon: '🌱', name: () => 'Hạt quý', desc: () => 'Thu hoạch 1 cây hạng A', goals: [1], reward: one(2), progress: (g) => (CROPS.some((c) => c.rank === 'A' && st(g, `harvest_${c.id}`) > 0) ? 1 : 0) })
  if (CROPS.some((c) => c.rank === 'S')) list.push({ id: 'crop_S', group: 'thu_hoach', icon: '🌱', name: () => 'Hạt huyền thoại', desc: () => 'Thu hoạch 1 cây hạng S', goals: [1], reward: one(4), progress: (g) => (CROPS.some((c) => c.rank === 'S' && st(g, `harvest_${c.id}`) > 0) ? 1 : 0) })

  // ---- Thu thập (chậu) ----
  many({ id: 'collector', group: 'thu_thap', icon: '🪴', name: () => 'Nhà sưu tầm chậu', desc: (n) => `Có ${n} loại chậu khác nhau`, goals: [6, 12, 24, 36, 48, 60], progress: (g) => countKeys(g, 'pot_') })
  for (const set of POT_SETS) {
    list.push({
      id: `set_${set.id}`, group: 'thu_thap', icon: '🪴', name: () => `Trọn bộ ${set.name}`, desc: (n) => `Có đủ ${n} chậu bộ ${set.name} (hạng ${set.rank})`,
      goals: [set.kinds.length], reward: one(SET_TIER[set.rank]), progress: (g) => set.kinds.filter((k) => st(g, `pot_${k}`) > 0).length,
    })
  }
  list.push({ id: 'pot_A', group: 'thu_thap', icon: '🪴', name: () => 'Chậu quý', desc: () => 'Có 1 chậu hạng A', goals: [1], reward: one(2), progress: (g) => potRankOwned(g, 'A') })
  list.push({ id: 'pot_S', group: 'thu_thap', icon: '🪴', name: () => 'Chậu huyền thoại', desc: () => 'Có 1 chậu hạng S', goals: [1], reward: one(4), progress: (g) => potRankOwned(g, 'S') })
  list.push({ id: 'full_tier', group: 'thu_thap', icon: '🏠', name: () => 'Vườn kín chỗ', desc: () => 'Đặt kín chậu mọi chỗ của 1 tầng mây', goals: [1], reward: one(1), progress: (g) => st(g, 'fullTier') })
  list.push({ id: 'pot_lv6', group: 'thu_thap', icon: '⭐', name: () => 'Chậu tinh xảo', desc: () => 'Đập 1 chậu lên cấp 6', goals: [1], reward: one(3), progress: (g) => st(g, 'potLv6') })
  list.push({ id: 'set_lv6', group: 'thu_thap', icon: '⭐', name: () => 'Bộ hoàn mỹ', desc: () => 'Có đủ 1 bộ chậu, mọi chậu đều cấp 6', goals: [1], reward: one(5), progress: (g) => st(g, 'setLv6') })
  list.push({ id: 'full_set_tier', group: 'thu_thap', icon: '⭐', name: () => 'Hiệu ứng trọn bộ', desc: () => 'Đặt đủ 1 bộ chậu trên cùng 1 tầng', goals: [1], reward: one(3), progress: (g) => st(g, 'fullSetTier') })

  // ---- Chăm sóc (gồm côn trùng) ----
  many({ id: 'sow', group: 'cham_soc', icon: '🫘', name: () => 'Gieo mầm', desc: (n) => `Gieo ${fmt(n)} hạt giống`, goals: [20, 100, 500, 2000], progress: (g) => st(g, 'sow') })
  many({ id: 'fertilize', group: 'cham_soc', icon: '🌱', name: () => 'Nhà nông chăm bón', desc: (n) => `Bón phân ${fmt(n)} lần`, goals: [20, 100, 500, 2000], progress: (g) => st(g, 'fertilize') })
  many({ id: 'full_days', group: 'cham_soc', icon: '📝', name: () => 'Chăm chỉ mỗi ngày', desc: (n) => `Xong đủ 5 nhiệm vụ hằng ngày ${fmt(n)} ngày`, goals: [1, 7, 30, 100], progress: (g) => st(g, 'fullDays') })
  many({ id: 'water', group: 'cham_soc', icon: '💧', name: () => 'Người tưới cây', desc: (n) => `Tưới cây ${fmt(n)} lần`, goals: [20, 100, 500, 2000], progress: (g) => st(g, 'water') })
  many({ id: 'catch', group: 'cham_soc', icon: '🐞', name: () => 'Thợ bắt côn trùng', desc: (n) => `Bắt ${fmt(n)} côn trùng`, goals: [10, 50, 200, 500, 1000], progress: (g) => st(g, 'catch') })
  for (const ins of INSECTS) {
    many({ id: `catch_${ins.id}`, group: 'cham_soc', icon: ins.icon, img: ins.img, name: () => `Săn ${ins.name.toLowerCase()}`, desc: (n) => `Bắt ${fmt(n)} ${ins.name.toLowerCase()}`, goals: [10, 50, 150], progress: (g) => st(g, `catch_${ins.id}`) })
  }
  list.push({ id: 'insect_kinds', group: 'cham_soc', icon: '🦋', name: () => 'Nhà côn trùng học', desc: (n) => `Bắt đủ ${n} loại côn trùng`, goals: [INSECTS.length], reward: one(1), progress: (g) => INSECTS.filter((i) => st(g, `catch_${i.id}`) > 0).length })

  // ---- Buôn bán ----
  many({ id: 'sold', group: 'buon_ban', icon: '🪙', name: () => 'Thương lái', desc: (n) => `Kiếm ${fmt(n)} lông chim từ bán nông sản`, goals: [500, 2000, 10000, 50000], progress: (g) => st(g, 'soldFeathers') })
  many({ id: 'bought', group: 'buon_ban', icon: '🛒', name: () => 'Khách quen', desc: (n) => `Mua ${fmt(n)} hạt giống ở cửa hàng`, goals: [50, 200, 1000], progress: (g) => st(g, 'boughtSeeds') })

  // ---- Ước nguyện ----
  many({ id: 'pulls', group: 'uoc_nguyen', icon: '🎁', name: () => 'Người ước nguyện', desc: (n) => `Quay tổng ${fmt(n)} lần`, goals: [10, 50, 100, 300, 500], progress: (g) => st(g, 'pulls') })
  list.push({ id: 'first_gold', group: 'uoc_nguyen', icon: '⭐', name: () => 'Ánh vàng đầu tiên', desc: () => 'Quay ra chậu hạng S (vàng)', goals: [1], reward: one(2), progress: (g) => (st(g, 'gold') > 0 ? 1 : 0) })
  return list
}

export const ACHIEVEMENTS = build()
export const achievementById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))

// Trạng thái 1 thành tựu: bậc đang xét (= số bậc đã nhận), tiến độ, có nhận được không, đã xong hết chưa
export interface AchState { a: Achievement; tier: number; goal: number; have: number; ready: boolean; done: boolean; readyCount: number }
export function achState(a: Achievement, g: AchSource, claimed: Record<string, number>): AchState {
  const tier = Math.min(claimed[a.id] ?? 0, a.goals.length)
  const have = a.progress(g)
  const done = tier >= a.goals.length
  const goal = a.goals[Math.min(tier, a.goals.length - 1)]
  const readyCount = a.goals.slice(tier).filter((n) => have >= n).length
  return { a, tier, goal, have, ready: !done && have >= goal, done, readyCount }
}
// Tổng số bậc đang chờ nhận (chấm đỏ)
export const readyTotal = (g: AchSource, claimed: Record<string, number>) => ACHIEVEMENTS.reduce((s, a) => s + achState(a, g, claimed).readyCount, 0)

// Cộng các phần thưởng
export function addReward(sum: Reward, r: Reward): Reward {
  return {
    feathers: (sum.feathers ?? 0) + (r.feathers ?? 0),
    stones: (sum.stones ?? 0) + (r.stones ?? 0),
    vong_tinh: (sum.vong_tinh ?? 0) + (r.vong_tinh ?? 0),
    sao_duyen: (sum.sao_duyen ?? 0) + (r.sao_duyen ?? 0),
  }
}
