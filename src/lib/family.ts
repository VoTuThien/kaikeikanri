import { collection } from 'firebase/firestore'
import { requireDb } from './firestore'

// Gia đình đang chọn. Mọi dữ liệu của các app con (Quỹ, Trạng thái, Chăm con) nằm trong
// families/{familyId}/... và chỉ thành viên của gia đình đó mới đọc / ghi được (xem firestore.rules).
// FamilyProvider đặt giá trị này mỗi khi người dùng đổi gia đình; các Provider của app con
// được tạo lại theo familyId nên luôn đọc / ghi đúng gia đình.
let activeFamilyId: string | null = null

export function setActiveFamily(id: string | null) {
  activeFamilyId = id
}

export function requireFamily() {
  if (!activeFamilyId) throw new Error('Chưa chọn gia đình')
  return activeFamilyId
}

// Collection dữ liệu của gia đình đang chọn, vd familyCol('funds') -> families/{id}/funds
export const familyCol = (name: string) => collection(requireDb(), 'families', requireFamily(), name)
