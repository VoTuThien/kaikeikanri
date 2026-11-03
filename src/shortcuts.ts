// Danh sách màn hình có thể tạo phím tắt (shortcut) ở màn hình chính.
// Chỉ gồm các màn hình mở TRỰC TIẾP từ ô chức năng ở trang chính của app con (vd Địa điểm),
// không gồm màn hình con mở từ bên trong (vd Tạo / Sửa địa điểm) và không gồm màn hình Cài đặt.
// QUY ƯỚC: thêm ô chức năng mới (màn hình mới) vào trang chính của app con thì thêm 1 dòng ở đây.
// `id` được lưu vào Firestore, KHÔNG đổi id của dòng đã có (đổi thì phím tắt người dùng đã tạo sẽ mất).
export interface ShortcutEntry {
  id: string
  appId: string // id của app con trong APPS (src/apps.ts), dùng để lấy màu nền và nhóm trong khung chọn
  name: string
  icon: string
  path: string
}

export const SHORTCUTS: ShortcutEntry[] = [
  // App Quỹ
  { id: 'fund-history', appId: 'fund', name: 'Tra cứu', icon: '🔍', path: '/fund/history' },
  { id: 'fund-stats', appId: 'fund', name: 'Thống kê', icon: '📊', path: '/fund/stats' },
  { id: 'fund-withdraw', appId: 'fund', name: 'Rút quỹ', icon: '➖', path: '/fund/withdraw' },
  { id: 'fund-deposit', appId: 'fund', name: 'Nạp quỹ', icon: '➕', path: '/fund/deposit' },
  { id: 'fund-transfer', appId: 'fund', name: 'Chuyển quỹ', icon: '🔄', path: '/fund/transfer' },
  { id: 'fund-salary', appId: 'fund', name: 'Lương', icon: '💼', path: '/fund/salary' },
  { id: 'fund-orders', appId: 'fund', name: 'Lệnh chuyển', icon: '📝', path: '/fund/orders' },
  { id: 'fund-execute', appId: 'fund', name: 'Thực thi', icon: '🚀', path: '/fund/execute' },
  { id: 'fund-groups', appId: 'fund', name: 'Nhóm quỹ', icon: '🗂️', path: '/fund/groups' },
  // App Trạng thái
  { id: 'status-live', appId: 'status', name: 'Trạng thái', icon: '👥', path: '/status/live' },
  { id: 'status-places', appId: 'status', name: 'Địa điểm', icon: '📍', path: '/status/places' },
  { id: 'status-map', appId: 'status', name: 'Bản đồ mini', icon: '🗺️', path: '/status/map' },
  // App Chăm con
  { id: 'baby-timeline', appId: 'baby', name: 'Time line', icon: '🕒', path: '/baby/timeline' },
  { id: 'baby-stats', appId: 'baby', name: 'Thống kê', icon: '📊', path: '/baby/stats' },
  { id: 'baby-children', appId: 'baby', name: 'Con', icon: '👶', path: '/baby/children' },
  { id: 'baby-cards', appId: 'baby', name: 'Thẻ hoạt động', icon: '🏷️', path: '/baby/cards' },
  // App Ghi chú
  { id: 'note-inbox', appId: 'note', name: 'Xem ghi chú', icon: '📬', path: '/note/inbox' },
  { id: 'note-new', appId: 'note', name: 'Tạo ghi chú', icon: '✍️', path: '/note/sent' },
  { id: 'note-cards', appId: 'note', name: 'Thẻ ghi chú', icon: '🏷️', path: '/note/cards' },
]

export const shortcutById = new Map(SHORTCUTS.map((s) => [s.id, s]))
