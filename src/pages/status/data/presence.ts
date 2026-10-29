import type { Place } from './types'

// Quy tắc gắn tag người dùng vào địa điểm (xem CLAUDE.md, App Trạng thái)
export const RADIUS_M = 100 // vào trong bán kính này thì tính là đang ở địa điểm
export const MAX_ACCURACY_M = 60 // lần đo GPS sai số lớn hơn thì bỏ qua
export const SWITCH_MARGIN_M = 15 // đang ở A mà B cũng trong 100m: B phải gần hơn A ít nhất chừng này mới chuyển

// Khoảng cách giữa 2 toạ độ (mét), công thức Haversine
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export interface Fix {
  lat: number
  lng: number
  accuracy: number // mét
}

export type Decision =
  | { action: 'inaccurate' } // sai số lớn, bỏ qua lần đo này
  | { action: 'stay'; nearest: { place: Place; distance: number } | null } // giữ nguyên địa điểm hiện tại
  | { action: 'pending'; placeId: string } // thấy địa điểm mới, chờ lần đo sau xác nhận
  | { action: 'switch'; placeId: string } // chuyển tag sang địa điểm mới

/**
 * Quyết định người dùng đang ở địa điểm nào sau 1 lần đo GPS.
 * - Ngoài 100m của mọi địa điểm: tag nằm yên ở địa điểm cũ.
 * - Trong 100m có nhiều địa điểm: chọn địa điểm gần nhất.
 * - Chống nhảy qua lại: bỏ lần đo kém chính xác, cần 2 lần đo liên tiếp cùng kết quả,
 *   và nếu địa điểm cũ vẫn trong 100m thì địa điểm mới phải gần hơn rõ rệt.
 * `force` (người dùng bấm cập nhật): chuyển ngay, không chờ lần đo thứ 2.
 */
export function decidePlace(
  places: Place[],
  currentPlaceId: string | null,
  fix: Fix,
  pendingPlaceId: string | null,
  force = false,
): Decision {
  if (fix.accuracy > MAX_ACCURACY_M) return { action: 'inaccurate' }

  const measured = places
    .map((place) => ({ place, distance: distanceM(fix.lat, fix.lng, place.lat, place.lng) }))
    .sort((a, b) => a.distance - b.distance)
  const nearest = measured[0] ?? null
  if (!nearest || nearest.distance > RADIUS_M) return { action: 'stay', nearest }
  if (nearest.place.id === currentPlaceId) return { action: 'stay', nearest }

  const current = measured.find((m) => m.place.id === currentPlaceId)
  if (current && current.distance <= RADIUS_M && current.distance - nearest.distance < SWITCH_MARGIN_M) {
    return { action: 'stay', nearest }
  }
  if (force || pendingPlaceId === nearest.place.id) return { action: 'switch', placeId: nearest.place.id }
  return { action: 'pending', placeId: nearest.place.id }
}
