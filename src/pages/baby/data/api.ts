import { addDoc, deleteDoc, doc, serverTimestamp, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { setBabyNotice } from '../../../lib/notifications'
import { addMinutes, type BabyCardInput, type BabyEntryInput, type ChildInput } from './types'

// Cấu trúc dữ liệu trên Firestore (chỉ thành viên gia đình xem / sửa được):
//   families/{familyId}/babyCards/{cardId}     thẻ hoạt động (tên, icon, màu, thời gian mặc định)
//   families/{familyId}/children/{childId}     con (tên, ngày / giờ sinh, giới tính, avatar)
//   families/{familyId}/babyEntries/{entryId}  hoạt động trên time line, có childId = của con nào (bắt đầu, số phút, kết thúc; chưa hoàn thành thì số phút / kết thúc = null)

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

function entryData({ childId, card, start, minutes }: BabyEntryInput) {
  return { childId, cardId: card.id, name: card.name, icon: card.icon, color: card.color, ...timing(start, minutes) }
}

// ---- Con ----
export const childrenCol = () => familyCol('children')

export async function createChild(input: ChildInput, by: Actor) {
  await commit(addDoc(childrenCol(), { ...input, createdAt: serverTimestamp(), createdBy: by.uid }))
}

export async function updateChild(id: string, input: ChildInput) {
  await commit(updateDoc(doc(childrenCol(), id), { ...input }))
}

// Xoá con không xoá các hoạt động đã ghi (chỉ không còn hiện trên time line / thống kê)
export async function deleteChild(id: string) {
  await commit(deleteDoc(doc(childrenCol(), id)))
}

// Giờ mới của 1 hoạt động liền kề (minutes = null: chưa hoàn thành, chỉ dời giờ bắt đầu)
export interface EntryTiming {
  id: string
  start: Date
  minutes: number | null
}

// Time line vừa được cập nhật: báo cho các thành viên khác (mỗi con 1 thông báo, ghi đè; xem src/lib/notifications.ts)
export interface TimelineNotice {
  child: { id: string; name: string } | null
  by: Actor
  detail: string // vd "Thêm Ăn lúc 07:00"
}

/**
 * Thêm hoạt động mới (ở cuối hoặc chèn vào giữa time line), đồng thời cập nhật hoạt động liền trước
 * (kết thúc = giờ bắt đầu mới) / liền sau (bắt đầu = giờ kết thúc mới) trong `linked`. Ghi cùng lúc trong 1 batch.
 */
export async function createEntry(input: BabyEntryInput, by: Actor, linked: EntryTiming[] = [], notice?: TimelineNotice) {
  const batch = writeBatch(requireDb())
  if (notice) setBabyNotice(batch, notice.child, notice.by, notice.detail)
  batch.set(doc(entriesCol()), { ...entryData(input), createdAt: serverTimestamp(), createdBy: by.uid, createdByName: by.name })
  for (const l of linked) batch.update(doc(entriesCol(), l.id), timing(l.start, l.minutes))
  await commit(batch.commit())
}

/**
 * Sửa hoạt động, đồng thời cập nhật các hoạt động liền trước / liền sau (`linked`) để time line nối liền,
 * không chồng lên nhau. Ghi cùng lúc trong 1 batch.
 */
export async function updateEntry(id: string, input: BabyEntryInput, linked: EntryTiming[] = [], notice?: TimelineNotice) {
  const batch = writeBatch(requireDb())
  if (notice) setBabyNotice(batch, notice.child, notice.by, notice.detail)
  batch.update(doc(entriesCol(), id), entryData(input))
  for (const l of linked) batch.update(doc(entriesCol(), l.id), timing(l.start, l.minutes))
  await commit(batch.commit())
}

export async function deleteEntry(id: string, notice?: TimelineNotice) {
  const batch = writeBatch(requireDb())
  batch.delete(doc(entriesCol(), id))
  if (notice) setBabyNotice(batch, notice.child, notice.by, notice.detail)
  await commit(batch.commit())
}
