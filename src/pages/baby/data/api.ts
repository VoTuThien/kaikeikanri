import { addDoc, deleteDoc, doc, serverTimestamp, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { addMinutes, type BabyCardInput, type BabyEntry, type BabyEntryInput } from './types'

// Cấu trúc dữ liệu trên Firestore (chỉ thành viên gia đình xem / sửa được):
//   families/{familyId}/babyCards/{cardId}     thẻ hoạt động (tên, icon, màu, thời gian mặc định)
//   families/{familyId}/babyEntries/{entryId}  hoạt động trên time line (bắt đầu, số phút, kết thúc; chưa hoàn thành thì số phút / kết thúc = null)

export const cardsCol = () => familyCol('babyCards')
export const entriesCol = () => familyCol('babyEntries')

export async function createCard(input: BabyCardInput, by: Actor) {
  await commit(addDoc(cardsCol(), { ...input, createdAt: serverTimestamp(), createdBy: by.uid }))
}

export async function updateCard(id: string, input: BabyCardInput) {
  await commit(updateDoc(doc(cardsCol(), id), { ...input }))
}

// Xoá thẻ không xoá các hoạt động đã ghi (hoạt động đã lưu sẵn tên / icon / màu)
export async function deleteCard(id: string) {
  await commit(deleteDoc(doc(cardsCol(), id)))
}

// Số phút / kết thúc của hoạt động; chưa hoàn thành thì cả hai là null
const timing = (start: Date, minutes: number | null) => ({
  start: Timestamp.fromDate(start),
  minutes,
  end: minutes === null ? null : Timestamp.fromDate(addMinutes(start, minutes)), // kết thúc = bắt đầu + thời gian hoạt động
})

function entryData({ card, start, minutes }: BabyEntryInput) {
  return { cardId: card.id, name: card.name, icon: card.icon, color: card.color, ...timing(start, minutes) }
}

/**
 * Thêm hoạt động mới. Nếu hoạt động cuối cùng đang chưa kết thúc (`unfinished`) thì kết thúc nó luôn
 * bằng giờ bắt đầu của hoạt động mới (ghi cùng lúc trong 1 batch).
 */
export async function createEntry(input: BabyEntryInput, by: Actor, unfinished: BabyEntry | null) {
  const batch = writeBatch(requireDb())
  batch.set(doc(entriesCol()), { ...entryData(input), createdAt: serverTimestamp(), createdBy: by.uid, createdByName: by.name })
  if (unfinished && input.start > unfinished.start) {
    const minutes = Math.round((input.start.getTime() - unfinished.start.getTime()) / 60000)
    batch.update(doc(entriesCol(), unfinished.id), timing(unfinished.start, minutes))
  }
  await commit(batch.commit())
}

export async function updateEntry(id: string, input: BabyEntryInput) {
  await commit(updateDoc(doc(entriesCol(), id), entryData(input)))
}

export async function deleteEntry(id: string) {
  await commit(deleteDoc(doc(entriesCol(), id)))
}
