import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
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
import { dropStep, moveStep, peekRedo, peekUndo, pushStep, sameData, type Snap } from './history'
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
// Trả về id các hoạt động mới (để ghi lịch sử Hoàn tác)
function addRest(batch: WriteBatch, rest: BabyEntryInput[], by: Actor): string[] {
  return rest.map((part) => {
    const ref = doc(entriesCol())
    batch.set(ref, { ...entryData(part), createdAt: serverTimestamp(), createdBy: by.uid, createdByName: by.name })
    return ref.id
  })
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
  const ref = doc(entriesCol())
  batch.set(ref, { ...entryData(first), createdAt: serverTimestamp(), createdBy: by.uid, createdByName: by.name })
  const created = [ref.id, ...addRest(batch, rest, by), ...extra.flatMap((e) => addRest(batch, splitAtMidnight(e), by))]
  for (const l of linked) batch.update(doc(entriesCol(), l.id), timing(l.start, l.minutes))
  await tracked(notice, linked.map((l) => l.id), created, () => commit(batch.commit()))
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
  const created = addRest(batch, rest, by)
  for (const l of linked) batch.update(doc(entriesCol(), l.id), timing(l.start, l.minutes))
  await tracked(notice, [id, ...linked.map((l) => l.id)], created, () => commit(batch.commit()))
}

export async function deleteEntry(id: string, notice?: TimelineNotice) {
  const batch = writeBatch(requireDb())
  batch.delete(doc(entriesCol(), id))
  if (notice) setBabyNotice(batch, notice.child, notice.by, notice.detail)
  await tracked(notice, [id], [], () => commit(batch.commit()))
}

// ---- Hoàn tác / Làm lại (xem data/history.ts) ----

// Phạm vi lịch sử = time line của gia đình đang chọn
export const historyScope = () => entriesCol().path

/**
 * Ghi 1 thao tác kèm lịch sử Hoàn tác: chụp lại các hoạt động bị đụng tới (`existing`) TRƯỚC khi ghi, ghi, rồi chụp lại SAU khi ghi
 * (gồm cả các hoạt động mới `created`). Chỉ ghi lịch sử khi có mạng (Hoàn tác cần đọc / ghi trực tiếp với server);
 * đọc lỗi thì vẫn ghi thao tác, chỉ là không hoàn tác được.
 */
async function tracked(notice: TimelineNotice | undefined, existing: string[], created: string[], write: () => Promise<void>) {
  const ids = [...new Set(existing)]
  const read = async (list: string[]): Promise<Snap> => {
    const snaps = await Promise.all(list.map((id) => getDoc(doc(entriesCol(), id))))
    return Object.fromEntries(snaps.map((s) => [s.id, s.exists() ? s.data() : null]))
  }
  const scope = historyScope()
  let before: Snap | null = null
  if (navigator.onLine) before = await read(ids).catch(() => null)
  await write()
  if (!before) return
  const after = await read([...ids, ...created]).catch(() => null)
  if (!after) return
  for (const id of created) before[id] = null
  pushStep(scope, { label: notice?.detail ?? 'Thao tác', child: notice?.child ?? null, before, after })
}

/**
 * Hoàn tác (`undo`) / làm lại (`redo`) bước gần nhất: đưa các hoạt động về đúng ảnh chụp trước / sau của bước đó trong 1 transaction.
 * Hoạt động đã bị thay đổi sau bước đó (người khác sửa, kéo, tự kết thúc lúc 24:00...) thì báo lỗi, không ghi gì và bỏ bước đó khỏi lịch sử.
 */
export async function applyHistory(kind: 'undo' | 'redo', by: Actor) {
  const scope = historyScope()
  const step = kind === 'undo' ? peekUndo(scope) : peekRedo(scope)
  if (!step) return
  const [expect, target] = kind === 'undo' ? [step.after, step.before] : [step.before, step.after]
  const ids = Object.keys(target)
  try {
    await runTransaction(requireDb(), async (tx) => {
      const snaps = await Promise.all(ids.map((id) => tx.get(doc(entriesCol(), id))))
      for (const s of snaps) {
        if (!sameData(s.exists() ? s.data() : null, expect[s.id] ?? null)) throw new HistoryConflict()
      }
      for (const id of ids) {
        const ref = doc(entriesCol(), id)
        const data = target[id]
        if (data) tx.set(ref, data)
        else tx.delete(ref)
      }
    })
  } catch (err) {
    if (err instanceof HistoryConflict) dropStep(scope, kind)
    throw err
  }
  moveStep(scope, kind)
  const batch = writeBatch(requireDb())
  setBabyNotice(batch, step.child, by, `${kind === 'undo' ? 'Hoàn tác' : 'Làm lại'}: ${step.label}`)
  await commit(batch.commit()).catch((err) => console.error(err))
}

export class HistoryConflict extends Error {
  constructor() {
    super('Time line đã thay đổi sau thao tác này (có người sửa hoặc hoạt động tự kết thúc), không hoàn tác / làm lại được nữa.')
  }
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
