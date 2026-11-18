// Nội dung bảng thông tin hiệu ứng khi đặt chậu (xem CLAUDE.md "Đặt chậu" mục 5) + dòng thay đổi trên từng ô của danh sách chậu.
import { EFFECTS, effectText, potKindById, potSetById, setsOnTier, slotKey, type OwnedPot, type PotSet } from '../data/pots'

export interface InfoLine { text: string; state: 'done' | 'next' | 'off' }
export interface Info { head: string | null; lines: InfoLine[]; summary: string }

// Các chậu đang đặt trên tầng
export function potsOnTier(pots: OwnedPot[], placed: Record<string, string>, tier: number) {
  const byId = new Map(pots.map((p) => [p.id, p]))
  return Object.entries(placed)
    .filter(([k]) => k.startsWith(`${tier}-`))
    .map(([, id]) => byId.get(id))
    .filter((p): p is OwnedPot => !!p)
}
export const isPlaced = (placed: Record<string, string>, id: string) => Object.values(placed).includes(id)
export { slotKey }

const fmt = (set: PotSet, v: number) => EFFECTS[set.effect].fmt(v)

// Các dòng mốc của 1 bộ với `count` chậu khác nhau, cấp trung bình `level`
function setLines(set: PotSet, count: number, level: number): InfoLine[] {
  const size = set.kinds.length
  const lines: InfoLine[] = []
  let nextShown = false
  for (const m of set.milestones) {
    const v = m.lv1 + ((m.lv6 - m.lv1) * (Math.max(1, Math.min(6, level)) - 1)) / 5
    const base = `${set.name} ${m.count}/${size}: ${effectText(set.effect, v)} · tối đa ${fmt(set, m.lv6)}`
    if (m.count <= count) lines.push({ text: `✓ ${base}`, state: 'done' })
    else if (!nextShown) { nextShown = true; lines.push({ text: `▶ ${base} (còn thiếu ${m.count - count} chậu)`, state: 'next' }) }
    else lines.push({ text: base, state: 'off' })
  }
  const b = set.bonus.lv1 + ((set.bonus.lv6 - set.bonus.lv1) * (Math.max(1, Math.min(6, level)) - 1)) / 5
  lines.push({
    text: `${count >= size ? '✓ ' : ''}Đủ bộ ${size}/${size}: ${effectText(set.bonus.effect, b)} · tối đa ${EFFECTS[set.bonus.effect].fmt(set.bonus.lv6)}`,
    state: count >= size ? 'done' : 'off',
  })
  return lines
}

// Bảng thông tin: đang chọn chậu `sel` → hiệu ứng của bộ đó nếu đặt; chưa chọn → hiệu ứng hiện tại của cả tầng
export function tierInfo(onTier: OwnedPot[], sel: OwnedPot | null): Info {
  const kind = sel && potKindById.get(sel.kind)
  const set = kind && potSetById.get(kind.set)
  if (sel && kind && set) {
    const before = setsOnTier(onTier).find((s) => s.set.id === set.id)
    const after = setsOnTier([...onTier, sel]).find((s) => s.set.id === set.id)!
    const n0 = before?.count ?? 0, n1 = after.count, size = set.kinds.length
    const dup = onTier.some((p) => p.kind === sel.kind)
    const head = dup
      ? 'Chậu trùng, không tăng hiệu ứng'
      : `Đặt chậu này: ${n0}/${size} → ${n1}/${size}${after.reached > (before?.reached ?? 0) ? ', đạt mốc mới!' : ''}`
    return { head, lines: setLines(set, n1, after.level), summary: after.value != null ? effectText(set.effect, after.value) : 'Chưa đạt mốc' }
  }
  const sets = setsOnTier(onTier)
  if (!sets.length) return { head: null, lines: [{ text: 'Tầng này chưa có hiệu ứng nào', state: 'off' }], summary: 'Chưa có hiệu ứng' }
  const lines: InfoLine[] = []
  for (const s of sets) {
    const size = s.set.kinds.length
    lines.push(
      s.value != null
        ? { text: `✓ ${s.set.name} ${s.count}/${size}: ${effectText(s.set.effect, s.value)}`, state: 'done' }
        : { text: `${s.set.name} ${s.count}/${size}: chưa đạt mốc (cần ${s.set.milestones[0].count} chậu khác nhau)`, state: 'off' },
    )
    if (s.bonus != null) lines.push({ text: `✓ ${s.set.name} đủ bộ: ${effectText(s.set.bonus.effect, s.bonus)}`, state: 'done' })
  }
  const first = sets.find((s) => s.value != null)
  return { head: 'Hiệu ứng hiện tại của tầng', lines, summary: first ? effectText(first.set.effect, first.value!) : 'Chưa đạt mốc' }
}

// Ô trong danh sách chậu: tiến độ bộ trên tầng + (nếu đặt chậu này giúp đạt mốc mới) dòng thay đổi
export function potCard(onTier: OwnedPot[], pot: OwnedPot) {
  const kind = potKindById.get(pot.kind)!
  const set = potSetById.get(kind.set)!
  const before = setsOnTier(onTier).find((s) => s.set.id === set.id)
  const after = setsOnTier([...onTier, pot]).find((s) => s.set.id === set.id)!
  const better = after.reached > (before?.reached ?? 0)
  return {
    kind,
    set,
    progress: `${set.name} ${before?.count ?? 0}/${set.kinds.length}`,
    change: better
      ? `${EFFECTS[set.effect].name} ${before?.value != null ? fmt(set, before.value) : '0%'} → ${fmt(set, after.value!)}`
      : null,
  }
}
