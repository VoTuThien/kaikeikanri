// Hằng số dùng chung của màn hình game Vườn mây (không phụ thuộc thư viện 3D, nên import được ở mọi nơi).

export const MENU_PATH = '/giai-tri'
export const GAME_PATH = '/giai-tri/vuon-may'
export const isGamePath = (pathname: string) => pathname === GAME_PATH || pathname.startsWith(`${GAME_PATH}/`)

// Số tầng mây và cấp độ mở khoá từng tầng (tầng 1 mở sẵn)
export const TIER_COUNT = 4
export const TIER_UNLOCK_LEVEL = [1, 5, 10, 15]

// Nhớ tầng đang xem (riêng từng tài khoản, trong máy)
const tierKey = (uid: string) => `vuon-may-tang:${uid}`
export function loadTier(uid: string): number {
  try {
    const n = Number(localStorage.getItem(tierKey(uid)))
    return Number.isInteger(n) && n >= 0 && n < TIER_COUNT ? n : 0
  } catch {
    return 0
  }
}
export function saveTier(uid: string, tier: number) {
  try {
    localStorage.setItem(tierKey(uid), String(tier))
  } catch {
    // trình duyệt chặn lưu: bỏ qua
  }
}

// Mẹo chơi hiện lần lượt ở màn hình tải
export const TIPS = [
  'Chạm mũi tên ▲ ▼ ở mép phải để chuyển giữa các tầng mây.',
  'Kéo 1 ngón để xoay quanh tầng mây, chụm / mở 2 ngón để phóng to, thu nhỏ.',
  'Kéo 2 ngón để dời khung nhìn khi đã phóng to.',
  'Tầng mây cao hơn mở khoá khi bạn lên cấp 5, 10 và 15.',
  'Tưới nước trước khi cây chín để thu thêm nông sản.',
  'Đặt đủ bộ chậu trên 1 tầng để nhận hiệu ứng mạnh nhất cho tầng đó.',
]
