import { pullMany, EMPTY_GACHA, OFF_SETS, BANNER_SETS } from '../../../src/pages/garden/data/gacha.ts'
const st = { ...EMPTY_GACHA }; const pots: any[] = []; const seeds = {}; const ins = {}
const N = 300000
let gold = 0, purple = 0, potB = 0, seed = 0, insect = 0, maxNoPurple = 0, run = 0, maxGoldGap = 0, gap = 0, off = 0, offThenOff = 0, prevOff = false
const goldAt: number[] = []
for (let i = 0; i < N; i++) {
  const [it] = pullMany(1, st, pots, seeds, ins, 'phuong_hoang')
  gap++
  if (it.rarity === 'gold') { gold++; goldAt.push(gap); maxGoldGap = Math.max(maxGoldGap, gap); gap = 0; const o = (it as any).off; if (o) { off++; if (prevOff) offThenOff++ } prevOff = o }
  if (it.rarity === 'purple') purple++
  if (it.rarity === 'blue' && it.type === 'pot') potB++
  if (it.type === 'seed') seed++
  if (it.type === 'insect') insect++
  if (it.rarity === 'blue') { run++; maxNoPurple = Math.max(maxNoPurple, run) } else run = 0
}
const avg = goldAt.reduce((a, b) => a + b, 0) / goldAt.length
const ph = pots.filter((p) => p.kind.startsWith('phuong_hoang')).length
console.log({ banner: BANNER_SETS, OFF_SETS, gold, avgPullsPerGold: avg.toFixed(1), maxGoldGap, purplePct: (purple / N * 100).toFixed(2), potBPct: (potB / N * 100).toFixed(2), seedPct: (seed / N * 100).toFixed(2), insectPct: (insect / N * 100).toFixed(2), maxNoPurple, offPct: (off / gold * 100).toFixed(1), offThenOff, phuongHoangPots: ph })
