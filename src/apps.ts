// Danh sách các app hiển thị ở màn hình chính.
// Thêm app mới: thêm 1 dòng ở đây và khai báo route tương ứng trong App.tsx.
export interface AppEntry {
  id: string
  name: string
  icon: string
  gradient: string // màu nền icon (class Tailwind)
  path?: string // chưa có path = app sắp ra mắt
}

export const APPS: AppEntry[] = [
  { id: 'fund', name: 'Quỹ', icon: '💰', gradient: 'from-amber-400 to-orange-500', path: '/fund' },
  { id: 'status', name: 'Trạng thái', icon: '🗺️', gradient: 'from-emerald-400 to-teal-600', path: '/status' },
  { id: 'baby', name: 'Chăm con', icon: '👶', gradient: 'from-pink-300 to-rose-500', path: '/baby' },
]
