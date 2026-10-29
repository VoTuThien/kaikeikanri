import { BOARD_SIZE, type Cell, type Place, type PlaceType } from './types'

// Số ô mỗi cạnh mà mô hình chiếm trên bản đồ mini.
// Công trình lớn chiếm 2x2 ô và được vẽ to gấp đôi (cao hơn hẳn các mô hình 1 ô).
const FOOTPRINT: Record<PlaceType, number> = {
  house: 1,
  market: 2,
  company: 2,
  tram: 1,
  bus: 1,
  supermarket: 2,
  hospital: 2,
}

export const footprint = (type: PlaceType) => FOOTPRINT[type]

// `cell` của địa điểm là ô góc trên-trái của vùng nó chiếm
export function overlaps(a: Cell, aSize: number, b: Cell, bSize: number) {
  return a.x < b.x + bSize && b.x < a.x + aSize && a.y < b.y + bSize && b.y < a.y + aSize
}

export const fitsBoard = (c: Cell, size: number) => c.x >= 0 && c.y >= 0 && c.x + size <= BOARD_SIZE && c.y + size <= BOARD_SIZE

// Điểm trên mặt đất (toạ độ lưới, 0..BOARD_SIZE) -> ô góc của mô hình sao cho tâm mô hình nằm dưới ngón tay
export function anchorAt(point: { x: number; y: number }, size: number): Cell {
  const clamp = (v: number) => Math.max(0, Math.min(BOARD_SIZE - size, v))
  return { x: clamp(Math.floor(point.x - (size - 1) / 2)), y: clamp(Math.floor(point.y - (size - 1) / 2)) }
}

// Kết quả khi thả mô hình vào 1 chỗ
export type DropPlan =
  | { kind: 'place' } // chỗ trống, đặt luôn
  | { kind: 'swap'; other: Place; otherCell: Cell | null } // đổi chỗ với 1 mô hình (null = mô hình kia về khay)
  | { kind: 'blocked' } // không đủ chỗ

export function planDrop(places: Place[], moving: Place, target: Cell): DropPlan {
  const size = footprint(moving.type)
  if (!fitsBoard(target, size)) return { kind: 'blocked' }
  const others = places.filter((p) => p.id !== moving.id && p.cell)
  const hits = others.filter((o) => overlaps(target, size, o.cell!, footprint(o.type)))
  if (hits.length === 0) return { kind: 'place' }
  if (hits.length > 1) return { kind: 'blocked' }

  const other = hits[0]
  // Kéo từ khay lên: mô hình đang chiếm chỗ về lại khay
  if (!moving.cell) return { kind: 'swap', other, otherCell: null }

  // Mô hình kia chuyển sang chỗ cũ của mô hình đang kéo: phải vừa bản đồ và không đè lên ai
  const otherSize = footprint(other.type)
  const otherCell = moving.cell
  if (!fitsBoard(otherCell, otherSize)) return { kind: 'blocked' }
  if (overlaps(otherCell, otherSize, target, size)) return { kind: 'blocked' }
  if (others.some((o) => o.id !== other.id && overlaps(otherCell, otherSize, o.cell!, footprint(o.type)))) {
    return { kind: 'blocked' }
  }
  return { kind: 'swap', other, otherCell }
}
