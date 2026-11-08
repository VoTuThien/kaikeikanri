import { collection, doc, onSnapshot, serverTimestamp, updateDoc, type Timestamp, type DocumentData, type DocumentReference, type WriteBatch } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import { requireFamily } from './family'
import { commit, requireDb, type Actor } from './firestore'
import { useLiveQuery } from './liveQuery'

// Thông báo LƯU LẠI của gia đình (luôn xem lại được trong popup của bong bóng thông báo, không tự mất):
//   families/{familyId}/notifications/{id}
// - Ghi chú gửi cho THÀNH VIÊN KHÁC (id `note_{noteId}`, chỉ người nhận thấy):
//   chờ hoàn thành -> "Hoàn thành" khi người nhận làm xong mọi thẻ; chạm để mở ghi chú đó ở Xem ghi chú
// - Time line của 1 con được cập nhật (id `baby_{childId}`, MỖI CON CHỈ 1 THÔNG BÁO, cập nhật đè chứ không thêm mới; mọi thành viên thấy):
//   "Mới" -> "Đã xem" khi người đó mở time line của con đó; cập nhật mới thì lại thành "Mới" (trừ người vừa cập nhật)
// Thông báo còn "Chưa xong" / "Mới" thì không ẩn được bong bóng thông báo.

export const notificationsCol = (familyId = requireFamily()) => collection(requireDb(), 'families', familyId, 'notifications')
export const noteNoticeId = (noteId: string) => `note_${noteId}`
export const babyNoticeId = (childId: string | null) => `baby_${childId ?? 'none'}`

interface NoticeBase {
  id: string
  updatedAt: Date | null
  active: boolean // còn cần xử lý: ghi chú chưa xong / time line chưa xem
}
export interface NoteNotice extends NoticeBase {
  kind: 'note'
  noteId: string
  noteName: string
  fromName: string
  toUid: string
  done: boolean
}
export interface BabyNotice extends NoticeBase {
  kind: 'baby'
  childId: string | null
  childName: string
  byUid: string
  byName: string
  detail: string // vd "Thêm Ăn lúc 07:00"
  seen: boolean
}
export type Notice = NoteNotice | BabyNotice

type Raw = Record<string, unknown>
const toDate = (v: unknown) => (v ? (v as Timestamp).toDate() : null)

function toNotice(id: string, d: Raw, uid: string): Notice | null {
  if (d.kind === 'note') {
    // Ghi chú: chỉ người nhận thấy
    if (d.toUid !== uid) return null
    const done = !!d.done
    return {
      id,
      kind: 'note',
      noteId: String(d.noteId ?? ''),
      noteName: String(d.noteName ?? ''),
      fromName: String(d.fromName ?? ''),
      toUid: String(d.toUid),
      done,
      updatedAt: toDate(d.updatedAt),
      active: !done,
    }
  }
  if (d.kind === 'baby') {
    // Người vừa cập nhật thì coi như đã xem
    const seen = d.byUid === uid || !!(d.seenBy as Record<string, boolean> | undefined)?.[uid]
    return {
      id,
      kind: 'baby',
      childId: (d.childId as string | null) ?? null,
      childName: String(d.childName ?? ''),
      byUid: String(d.byUid ?? ''),
      byName: String(d.byName ?? ''),
      detail: String(d.detail ?? ''),
      seen,
      updatedAt: toDate(d.updatedAt),
      active: !seen,
    }
  }
  return null
}

/**
 * Thông báo của người đang đăng nhập trong gia đình đang chọn (mới nhất trước), cập nhật realtime.
 * `active` = số thông báo còn cần xử lý (cộng vào số đếm của bong bóng, khoá không cho ẩn bong bóng).
 */
export function useNotices(): { list: Notice[]; active: number } {
  const { user } = useAuth()
  const { current } = useFamily()
  const familyId = current?.familyId
  const uid = user?.uid ?? ''
  const raw = useLiveQuery<{ id: string; data: Raw }[]>(familyId && uid ? `${familyId}:notifications` : null, (on) =>
    onSnapshot(notificationsCol(familyId!), (snap) =>
      on(
        snap.docs.map((d) => ({ id: d.id, data: d.data({ serverTimestamps: 'estimate' }) })),
        snap.metadata.fromCache,
      ),
    ),
  )
  const list = (raw ?? [])
    .map((r) => toNotice(r.id, r.data, uid))
    .filter((n): n is Notice => !!n)
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
  return { list, active: list.filter((n) => n.active).length }
}

// ---- Ghi (trong batch / transaction của thao tác chính) ----

// Gửi ghi chú cho thành viên khác: tạo thông báo cho người nhận (chưa xong)
export function setNoteNotice(
  batch: { set: (ref: DocumentReference, data: DocumentData) => unknown }, // WriteBatch hoặc Transaction
  note: { id: string; name: string; toUid: string; fromUid: string; fromName: string },
  done = false,
) {
  batch.set(doc(notificationsCol(), noteNoticeId(note.id)), {
    kind: 'note',
    noteId: note.id,
    noteName: note.name,
    toUid: note.toUid,
    fromUid: note.fromUid,
    fromName: note.fromName,
    done,
    updatedAt: serverTimestamp(),
  })
}

// Time line của 1 con vừa được cập nhật: ĐÈ lên thông báo cũ của con đó (mỗi con 1 thông báo), mọi người khác thành "Mới"
export function setBabyNotice(batch: WriteBatch, child: { id: string; name: string } | null, by: Actor, detail: string) {
  batch.set(doc(notificationsCol(), babyNoticeId(child?.id ?? null)), {
    kind: 'baby',
    childId: child?.id ?? null,
    childName: child?.name ?? '',
    byUid: by.uid,
    byName: by.name,
    detail,
    updatedAt: serverTimestamp(),
    seenBy: { [by.uid]: true },
  })
}

// Đã xem time line của con này
export async function markBabySeen(childId: string | null, uid: string) {
  await commit(updateDoc(doc(notificationsCol(), babyNoticeId(childId)), { [`seenBy.${uid}`]: true }))
}
