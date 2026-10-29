import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import type { Actor } from '../lib/firestore'

// Dùng cho Layout của mỗi app con (Quỹ, Trạng thái, Chăm con):
// - chưa đăng nhập -> về trang đăng nhập; chưa có / chưa chọn gia đình -> về màn hình chính để chọn
// - `key` đổi khi đổi tài khoản hoặc đổi gia đình, để Provider của app con tạo lại và đọc đúng dữ liệu gia đình
// - `actor` = null trong lúc đang tải (Provider hiện skeleton)
export function useAppScope(): { redirect: string | null; actor: Actor | null; key: string } {
  const { user, loading } = useAuth()
  const { current, loading: familyLoading } = useFamily()
  if (!loading && !user) return { redirect: '/login', actor: null, key: 'none' }
  if (!loading && !familyLoading && !current) return { redirect: '/', actor: null, key: 'none' }
  const actor = user && current ? { uid: user.uid, name: user.displayName || user.email || '' } : null
  return { redirect: null, actor, key: `${user?.uid ?? ''}:${current?.familyId ?? ''}` }
}
