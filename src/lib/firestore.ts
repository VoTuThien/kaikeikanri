import { db } from './firebase'

export function requireDb() {
  if (!db) throw new Error('Firebase chưa được cấu hình')
  return db
}

// Có mạng: chờ server xác nhận. Mất mạng: Firestore lưu tạm trong máy và tự gửi khi có mạng lại,
// nên không chờ (nếu chờ thì nút sẽ quay mãi).
export async function commit(write: Promise<unknown>) {
  if (navigator.onLine) await write
  else write.catch((e) => console.error('Đồng bộ thất bại', e))
}

// Người thực hiện thao tác, lưu kèm dữ liệu để biết ai đã tạo / sửa
export interface Actor {
  uid: string
  name: string
}
