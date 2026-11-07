import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { setBabyNotice } from '../../../lib/notifications'
import { addMinutes, nextMidnight, startOfDay, type BabyCardInput, type BabyEntryInput, type ChildInput } from './types'

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

const minutesTo = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 60000)

/**
 * 1 ngày của time line là 00:00 → 24:00. Hoạt động kết thúc sau 24:00 thì tách thành nhiều hoạt động, mỗi ngày 1 hoạt động:
 * vd ngày 2 nhập 23:00 → 4:00 thành [ngày 2: 23:00 → 0:00] + [ngày 3: 0:00 → 4:00].
 * Phần đầu là hoạt động gốc, các phần sau là hoạt động mới. Chưa hoàn thành (minutes = null) thì không tách.
 */
export function splitAtMidnight(input: BabyEntryInput): BabyEntryInput[] {
  const parts: BabyEntryInput[] = []
  let { start, minutes } = input
  while (minutes !== null && addMinutes(start, minutes) > nextMidnight(start)) {
    const head = minutesTo(start, nextMidnight(start))
    parts.push({ ...input, start, minutes: head })
    start = nextMidnight(start)
    minutes -= head
  }
  parts.push({ ...input, start, minutes })
  return parts
}

// Các phần sau nửa đêm của 1 hoạt động: ghi thành hoạt động mới của ngày hôm sau (cùng batch)
function addRest(batch: WriteBatch, rest: BabyEntryInput[], by: Actor) {
  for (const part of rest) {
    batch.set(doc(entriesCol()), { ...entryData(part), createdAt: serverTimestamp(), createdBy: by.uid, createdByName: by.name })
  }
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
 * Thêm hoạt động mới (ở cuối hoặc chèn vào giữa time line; kết thúc sau 24:00 thì tách sang ngày hôm sau, xem splitAtMidnight), đồng thời cập nhật hoạt động liền trước
 * (kết thúc = giờ bắt đầu mới) / liền sau (bắt đầu = giờ kết thúc mới) trong `linked`. Ghi cùng lúc trong 1 batch.
 * `extra`: các hoạt động thêm cùng lúc (vd phần sau của hoạt động bị tách đôi khi chèn lọt hẳn vào trong nó).
 */
export async function createEntry(input: BabyEntryInput, by: Actor, linked: EntryTiming[] = [], notice?: TimelineNotice, extra: BabyEntryInput[] = []) {
  const batch = writeBatch(requireDb())
  if (notice) setBabyNotice(batch, notice.child, notice.by, notice.detail)
  const [first, ...rest] = splitAtMidnight(input)
  batch.set(doc(entriesCol()), { ...entryData(first), createdAt: serverTimestamp(), createdBy: by.uid, createdByName: by.name })
  addRest(batch, rest, by)
  for (const e of extra) addRest(batch, splitAtMidnight(e), by)
  for (const l of linked) batch.update(doc(entriesCol(), l.id), timing(l.start, l.minutes))
  await commit(batch.commit())
}

/**
 * Sửa hoạt động (kết thúc sau 24:00 thì phần sau nửa đêm thành hoạt động mới của ngày hôm sau), đồng thời cập nhật các hoạt động liền trước / liền sau (`linked`) để time line nối liền,
 * không chồng lên nhau. Ghi cùng lúc trong 1 batch.
 */
export async function updateEntry(id: string, input: BabyEntryInput, by: Actor, linked: EntryTiming[] = [], notice?: TimelineNotice) {
  const batch = writeBatch(requireDb())
  if (notice) setBabyNotice(batch, notice.child, notice.by, notice.detail)
  const [first, ...rest] = splitAtMidnight(input)
  batch.update(doc(entriesCol(), id), entryData(first))
  addRest(batch, rest, by)
  for (const l of linked) batch.update(doc(entriesCol(), l.id), timing(l.start, l.minutes))
  await commit(batch.commit())
}

export async function deleteEntry(id: string, notice?: TimelineNotice) {
  const batch = writeBatch(requireDb())
  batch.delete(doc(entriesCol(), id))
  if (notice) setBabyNotice(batch, notice.child, notice.by, notice.detail)
  await commit(batch.commit())
}

/**
 * Hoạt động chưa kết thúc của những ngày trước hôm nay: tự kết thúc lúc 24:00 (= 0:00 hôm sau) của ngày nó bắt đầu.
 * Gọi khi mở màn hình Time line. Chỉ truy vấn `end == null` (không cần chỉ mục ghép), lọc ngày trên máy vì hoạt động dở dang rất ít.
 */
export async function closeStaleEntries(now = new Date()) {
  const today = startOfDay(now)
  const snap = await getDocs(query(entriesCol(), where('end', '==', null)))
  const stale = snap.docs
    .map((d) => ({ ref: d.ref, start: (d.data().start as Timestamp | undefined)?.toDate() }))
    .filter((d): d is { ref: typeof d.ref; start: Date } => !!d.start && d.start < today)
  if (!stale.length) return
  const batch = writeBatch(requireDb())
  for (const d of stale) batch.update(d.ref, timing(d.start, minutesTo(d.start, nextMidnight(d.start))))
  await commit(batch.commit())
}
