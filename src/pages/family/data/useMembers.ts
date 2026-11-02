import { onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore'
import { useLiveQuery } from '../../../lib/liveQuery'
import { membersCol, type Member } from './api'

// Thành viên của gia đình, cập nhật realtime, có nhớ tạm (liveQuery). null = đang tải lần đầu.
// Dùng ở Quản lý gia đình và các màn hình của app Quỹ (Thực thi, Lương).
export function useMembers(familyId: string | undefined): Member[] | null {
  return useLiveQuery<Member[]>(familyId ? `${familyId}:members` : null, (on) =>
    onSnapshot(query(membersCol(familyId!), orderBy('joinedAt', 'asc')), (snap) =>
      on(
        snap.docs.map((d) => {
          const v = d.data({ serverTimestamps: 'estimate' })
          return {
            uid: d.id,
            name: v.name ?? '',
            email: v.email ?? '',
            role: v.role === 'owner' ? 'owner' : 'member',
            joinedAt: v.joinedAt ? (v.joinedAt as Timestamp).toDate() : null,
          }
        }),
        snap.metadata.fromCache,
      ),
    ),
  )
}
