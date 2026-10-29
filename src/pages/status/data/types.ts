export type PlaceType = 'house' | 'market' | 'company' | 'tram' | 'bus' | 'supermarket' | 'hospital'

// Các loại địa điểm: mỗi loại có 1 mô hình 3D (models/PlaceModels.tsx) và 1 icon 3D ảnh
export const PLACE_TYPES: { value: PlaceType; label: string; emoji: string }[] = [
  { value: 'house', label: 'Nhà ở', emoji: '🏠' },
  { value: 'market', label: 'Chợ', emoji: '🏪' },
  { value: 'company', label: 'Công ty', emoji: '🏢' },
  { value: 'tram', label: 'Trạm xe điện', emoji: '🚋' },
  { value: 'bus', label: 'Trạm xe buýt', emoji: '🚏' },
  { value: 'supermarket', label: 'Siêu thị', emoji: '🛒' },
  { value: 'hospital', label: 'Bệnh viện', emoji: '🏥' },
]

export const placeTypeInfo = (type: PlaceType) => PLACE_TYPES.find((t) => t.value === type) ?? PLACE_TYPES[0]

// Bản đồ mini chia lưới BOARD_SIZE x BOARD_SIZE ô; x là cột, y là hàng, đều từ 0
export const BOARD_SIZE = 16
export interface Cell {
  x: number
  y: number
}
export const sameCell = (a: Cell | null, b: Cell | null) => !!a && !!b && a.x === b.x && a.y === b.y

export interface Place {
  id: string
  name: string
  type: PlaceType
  lat: number
  lng: number
  note: string
  // Ô trên bản đồ mini (bàn cờ), null = chưa đặt lên bản đồ
  cell: Cell | null
  createdAt: Date | null
}

// Người dùng đang ở địa điểm nào (chỉ lưu địa điểm, KHÔNG lưu toạ độ thật)
export interface Presence {
  uid: string
  name: string
  placeId: string | null // null = chưa xác định
  since: Date | null // tới địa điểm này từ lúc nào
}

export interface PlaceInput {
  name: string
  type: PlaceType
  lat: number
  lng: number
  note: string
}
