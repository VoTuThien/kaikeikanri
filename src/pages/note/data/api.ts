import { doc, increment, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type WriteBatch } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { formatMoney } from '../../../lib/format'
import { noteNoticeId, notificationsCol, setNoteNotice } from '../../../lib/notifications'
import { fundsCol, txCol } from '../../fund/data/api'
import { newItemId, noteDone, sameKey, uniqueItemIds, type NoteCard, type NoteItem, type NoteSettings } from './types'

// Cấu trúc dữ liệu trên Firestore (chỉ thành viên gia đình xem / sửa được):
//   families/{familyId}/notes/{noteId}      ghi chú gửi đến 1 thành viên (toUid), các thẻ nằm trong mảng items theo thứ tự ưu tiên
//   families/{familyId}/noteCards/{cardId}  thẻ ghi chú đã từng nhập (gợi ý khi tạo ghi chú), không trùng nội dung, có số thứ tự
//   users/{uid}/settings/note               cài đặt riêng của từng tài khoản (quỹ mặc định khi nạp / rút)

export const notesCol = () => familyCol('notes')
export const noteCardsCol = () => familyCol('noteCards')
export const noteSettingsDoc = (uid: string) => doc(requireDb(), 'users', uid, 'settings', 'note')

// Đánh số thứ tự 1, 2, 3... cho các thẻ `ids` theo vị trí trong danh sách thứ tự mới `order`
function renumber(batch: WriteBatch, ids: string[], order: string[] = ids) {
  for (const id of ids) batch.update(doc(noteCardsCol(), id), { position: order.indexOf(id) + 1 })
}

// Như trên, cho các ghi chú (của cùng 1 người nhận)
function renumberNotes(batch: WriteBatch, ids: string[], order: string[] = ids) {
  for (const id of ids) batch.update(doc(notesCol(), id), { position: order.indexOf(id) + 1 })
}

// Chèn id vào vị trí position (1-based) trong danh sách
function insertAt(ids: string[], id: string, position: number) {
  const next = [...ids]
  next.splice(Math.max(0, Math.min(ids.length, position - 1)), 0, id)
  return next
}

// Thẻ có nội dung chưa có trong danh sách thẻ (không phân biệt hoa thường / khoảng trắng thừa)
export function newTexts(texts: string[], cards: Pick<NoteCard, 'text'>[]) {
  const seen = new Set(cards.map((c) => sameKey(c.text)))
  return texts.filter((t) => {
    const k = sameKey(t)
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Gửi ghi chú (tên + các thẻ) cho 1 thành viên, đặt ở số thứ tự `position` trong các ghi chú của người nhận đó
 * (`ids` = id các ghi chú hiện có của người nhận theo thứ tự; các ghi chú còn lại được đánh số lại).
 * Cùng lúc lưu các thẻ có nội dung mới vào Thẻ ghi chú (để gợi ý sau này), thêm vào cuối danh sách gợi ý;
 * thẻ trùng nội dung với thẻ đã có thì không lưu.
 */
export async function createNote(
  to: { uid: string; name: string },
  name: string,
  texts: string[],
  by: Actor,
  cards: NoteCard[],
  ids: string[],
  position: number,
) {
  const batch = writeBatch(requireDb())
  const ref = doc(notesCol())
  const order = insertAt(ids, ref.id, position)
  const items: NoteItem[] = texts.map((text) => ({ id: newItemId(), text, done: false, doneByName: '', money: [] }))
  renumberNotes(batch, ids, order)
  batch.set(ref, {
    name,
    position: order.indexOf(ref.id) + 1,
    toUid: to.uid,
    toName: to.name,
    fromUid: by.uid,
    fromName: by.name,
    items,
    createdAt: serverTimestamp(),
  })
  // Gửi cho thành viên khác (không phải tự ghi cho mình): thông báo cho người nhận
  if (to.uid !== by.uid) setNoteNotice(batch, { id: ref.id, name, toUid: to.uid, fromUid: by.uid, fromName: by.name })
  addNewCards(batch, texts, cards, by)
  await commit(batch.commit())
}

/**
 * Sửa ghi chú: tên, số thứ tự (`ids` = các ghi chú của người nhận theo thứ tự hiện tại) và các thẻ nội dung
 * (`items` theo thứ tự mới; thẻ cũ giữ trạng thái đã xong). Thẻ có nội dung mới cũng được lưu vào Thẻ ghi chú.
 * Ghi chú gửi cho thành viên khác (`meta`): cập nhật lại thông báo của người nhận (tên, đã hoàn thành chưa).
 */
export async function updateNote(
  id: string,
  name: string,
  items: NoteItem[],
  by: Actor,
  cards: NoteCard[],
  ids: string[],
  position: number,
  // Đổi người nhận: `toUid` / `toName` mới, `ids` = các ghi chú của người nhận MỚI, `oldIds` = các ghi chú của người nhận cũ (đánh số lại sau khi ghi chú rời đi)
  meta: { toUid: string; toName: string; fromUid: string; fromName: string; oldIds?: string[] },
) {
  const batch = writeBatch(requireDb())
  const moved = !!meta.oldIds
  const notice = { id, name, toUid: meta.toUid, fromUid: meta.fromUid, fromName: meta.fromName }
  if (meta.toUid !== meta.fromUid) setNoteNotice(batch, notice, noteDone({ items }))
  // Đổi sang gửi cho chính mình: ghi chú tự ghi không có thông báo -> xoá thông báo cũ của người nhận trước
  else if (moved) batch.delete(doc(notificationsCol(), noteNoticeId(id)))
  const order = insertAt(
    ids.filter((x) => x !== id),
    id,
    position,
  )
  batch.update(doc(notesCol(), id), {
    name,
    items,
    position: order.indexOf(id) + 1,
    ...(moved ? { toUid: meta.toUid, toName: meta.toName } : {}),
  })
  renumberNotes(
    batch,
    order.filter((x) => x !== id),
    order,
  )
  if (meta.oldIds) renumberNotes(batch, meta.oldIds.filter((x) => x !== id))
  addNewCards(
    batch,
    items.map((i) => i.text),
    cards,
    by,
  )
  await commit(batch.commit())
}

/**
 * Tạo ghi chú mới từ các nội dung CHƯA XONG của ghi chú `sourceId` (1 transaction): `rows` có key = id thẻ của ghi chú cũ thì CHUYỂN thẻ đó sang
 * (giữ các lần nạp / rút, lấy nội dung đã sửa), key khác là thẻ mới. Thẻ vừa được đánh dấu xong trong lúc soạn thì ở lại ghi chú cũ.
 * `ids` = các ghi chú của người nhận theo thứ tự hiện tại; thông báo của ghi chú cũ cập nhật lại "Hoàn thành" (còn lại toàn thẻ đã xong).
 */
export async function moveItemsToNewNote(
  sourceId: string,
  name: string,
  rows: { key: string; text: string }[],
  by: Actor,
  cards: NoteCard[],
  ids: string[],
  position: number,
) {
  const sourceRef = doc(notesCol(), sourceId)
  const ref = doc(notesCol())
  await commit(
    runTransaction(requireDb(), async (tx) => {
      const snap = await tx.get(sourceRef)
      if (!snap.exists()) throw new Error('Ghi chú cũ không còn.')
      const notice = await tx.get(doc(notificationsCol(), noteNoticeId(sourceId)))
      const data = snap.data()
      const old = uniqueItemIds((data.items ?? []) as NoteItem[])
      const byId = new Map(old.map((i) => [i.id, i]))
      const items: NoteItem[] = rows.flatMap((r) => {
        const prev = byId.get(r.key)
        if (prev?.done) return []
        return [prev ? { ...prev, text: r.text } : { id: r.key, text: r.text, done: false, doneByName: '', money: [] }]
      })
      if (items.length === 0) throw new Error('Ghi chú mới không còn nội dung để chuyển.')
      const moved = new Set(items.map((i) => i.id))
      const rest = old.filter((i) => !moved.has(i.id))
      if (rest.length === 0) throw new Error('Ghi chú cũ sẽ không còn nội dung nào.')

      const order = insertAt(ids, ref.id, position)
      for (const id of ids) tx.update(doc(notesCol(), id), { position: order.indexOf(id) + 1 })
      tx.update(sourceRef, { items: rest })
      if (notice.exists()) tx.update(notice.ref, { done: noteDone({ items: rest }) })
      tx.set(ref, {
        name,
        position: order.indexOf(ref.id) + 1,
        toUid: data.toUid,
        toName: data.toName,
        fromUid: by.uid,
        fromName: by.name,
        items,
        createdAt: serverTimestamp(),
      })
      if (data.toUid !== by.uid) setNoteNotice(tx, { id: ref.id, name, toUid: data.toUid, fromUid: by.uid, fromName: by.name })
      newTexts(items.map((i) => i.text), cards).forEach((text, i) => {
        tx.set(doc(noteCardsCol()), { text, position: cards.length + i + 1, createdAt: serverTimestamp(), createdBy: by.uid })
      })
    }),
  )
}

// Lưu các thẻ có nội dung mới vào Thẻ ghi chú, thêm vào cuối danh sách gợi ý
function addNewCards(batch: WriteBatch, texts: string[], cards: NoteCard[], by: Actor) {
  newTexts(texts, cards).forEach((text, i) => {
    batch.set(doc(noteCardsCol()), { text, position: cards.length + i + 1, createdAt: serverTimestamp(), createdBy: by.uid })
  })
}

/**
 * Gộp các nội dung CHƯA XONG của các ghi chú `sourceIds` vào CUỐI ghi chú `targetId` (1 transaction, màn hình Sửa ghi chú):
 * thẻ được CHUYỂN sang (giữ id, các lần nạp / rút); thẻ trùng nội dung với thẻ đã có thì gộp vào thẻ đó (cộng các lần nạp / rút, thành chưa xong).
 * Ghi chú nguồn chỉ còn các thẻ đã xong (thông báo thành "Hoàn thành"); hết sạch nội dung thì xoá luôn ghi chú + thông báo của nó.
 * `ids` = các ghi chú của người nhận theo thứ tự hiện tại (đánh số lại khi có ghi chú nguồn bị xoá). Trả về id các thẻ của ghi chú đích đã nhận nội dung.
 */
export async function mergeIntoNote(targetId: string, sourceIds: string[], ids: string[]): Promise<string[]> {
  const targetRef = doc(notesCol(), targetId)
  let moved: string[] = []
  await commit(
    runTransaction(requireDb(), async (tx) => {
      // Firestore: đọc hết rồi mới ghi
      const target = await tx.get(targetRef)
      if (!target.exists()) throw new Error('Ghi chú này không còn.')
      const sources = await Promise.all(sourceIds.map((id) => tx.get(doc(notesCol(), id))))
      const notices = await Promise.all([targetId, ...sourceIds].map((id) => tx.get(doc(notificationsCol(), noteNoticeId(id)))))
      const noticeOf = new Map(notices.map((n, i) => [[targetId, ...sourceIds][i], n]))

      const items = uniqueItemIds((target.data().items ?? []) as NoteItem[])
      const usedIds = new Set(items.map((it) => it.id))
      const byKey = new Map(items.map((it, i) => [sameKey(it.text), i]))
      const removed = new Set<string>()
      moved = []
      for (const snap of sources) {
        if (!snap.exists() || snap.id === targetId) continue
        const list = uniqueItemIds((snap.data().items ?? []) as NoteItem[])
        const pending = list.filter((it) => !it.done)
        if (pending.length === 0) continue
        for (const it of pending) {
          const k = sameKey(it.text)
          const at = byKey.get(k)
          if (at !== undefined) {
            const ex = items[at]
            items[at] = { ...ex, done: false, doneByName: '', money: [...(ex.money ?? []), ...(it.money ?? [])] }
            moved.push(ex.id)
          } else {
            // Id của thẻ chuyển sang trùng với thẻ đã có (ghi chú cũ đánh id "i1", "i2"…) thì cấp id mới
            const moving = usedIds.has(it.id) ? { ...it, id: newItemId() } : it
            usedIds.add(moving.id)
            byKey.set(k, items.length)
            items.push(moving)
            moved.push(moving.id)
          }
        }
        const rest = list.filter((it) => it.done)
        const notice = noticeOf.get(snap.id)
        if (rest.length > 0) {
          tx.update(snap.ref, { items: rest })
          if (notice?.exists()) tx.update(notice.ref, { done: true })
        } else {
          tx.delete(snap.ref)
          if (notice?.exists()) tx.delete(notice.ref)
          removed.add(snap.id)
        }
      }
      if (moved.length === 0) throw new Error('Các ghi chú đã chọn không còn nội dung chưa xong.')
      tx.update(targetRef, { items })
      const targetNotice = noticeOf.get(targetId)
      if (targetNotice?.exists()) tx.update(targetNotice.ref, { done: false })
      // Ghi chú nguồn bị xoá: đánh số lại các ghi chú còn lại của người nhận (liên tục 1..n)
      if (removed.size > 0) {
        ids
          .filter((id) => !removed.has(id))
          .forEach((id, i) => tx.update(doc(notesCol(), id), { position: i + 1 }))
      }
    }),
  )
  return moved
}

// Đánh dấu 1 thẻ trong ghi chú là đã làm xong / chưa xong (đọc lại ghi chú trong transaction để không ghi đè thẻ khác)
export async function setItemDone(noteId: string, itemId: string, done: boolean, by: Actor) {
  const ref = doc(notesCol(), noteId)
  await commit(
    runTransaction(requireDb(), async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const notice = await tx.get(doc(notificationsCol(), noteNoticeId(noteId)))
      const items = uniqueItemIds((snap.data().items ?? []) as NoteItem[]).map((i) =>
        i.id === itemId ? { ...i, done, doneByName: done ? by.name : '' } : i,
      )
      tx.update(ref, { items })
      // Thông báo của người nhận: làm xong mọi thẻ thì thành "Hoàn thành" (bỏ đánh dấu thì lại "Chưa xong")
      if (notice.exists()) tx.update(notice.ref, { done: noteDone({ items }) })
    }),
  )
}

/**
 * Người nhận thêm 1 thẻ nội dung mới vào cuối ghi chú ngay ở màn hình Xem ghi chú (vd phát sinh khoản nạp / rút chưa có trong ghi chú).
 * Đọc lại ghi chú trong transaction để không ghi đè thẻ khác; trùng nội dung với thẻ đã có thì báo lỗi.
 * Ghi chú đang "Hoàn thành" thì thông báo của người nhận lại thành "Chưa xong" (thẻ mới chưa xong).
 * Thẻ có nội dung mới cũng được lưu vào Thẻ ghi chú (gợi ý). Trả về id của thẻ mới.
 */
export async function addNoteItem(noteId: string, text: string, by: Actor, cards: NoteCard[]): Promise<string> {
  const ref = doc(notesCol(), noteId)
  const id = newItemId()
  await commit(
    runTransaction(requireDb(), async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists()) throw new Error('Ghi chú không còn.')
      const notice = await tx.get(doc(notificationsCol(), noteNoticeId(noteId)))
      const old = uniqueItemIds((snap.data().items ?? []) as NoteItem[])
      if (old.some((i) => sameKey(i.text) === sameKey(text))) throw new Error('Mục này đã có trong ghi chú.')
      const items: NoteItem[] = [...old, { id, text, done: false, doneByName: '', money: [] }]
      tx.update(ref, { items })
      if (notice.exists()) tx.update(notice.ref, { done: noteDone({ items }) })
      newTexts([text], cards).forEach((t) => {
        tx.set(doc(noteCardsCol()), { text: t, position: cards.length + 1, createdAt: serverTimestamp(), createdBy: by.uid })
      })
    }),
  )
  return id
}

// Kéo thả / đổi số thứ tự các ghi chú: lưu thứ tự mới
export async function reorderNotes(ids: string[]) {
  const batch = writeBatch(requireDb())
  renumberNotes(batch, ids)
  await commit(batch.commit())
}

/**
 * Nạp / rút quỹ cho RIÊNG 1 thẻ nội dung (vd "Mua cà chua" rút 30.000 ₫ từ quỹ chi tiêu). Trong 1 transaction:
 * ghi giao dịch ở app Quỹ (ghi chú giao dịch = `memo`), cập nhật số dư quỹ và gắn lần nạp / rút này vào thẻ (`money`).
 * Rút quá số dư (đọc mới trong transaction) thì báo lỗi, không ghi gì.
 */
export async function addItemMoney(
  noteId: string,
  itemId: string,
  fundId: string,
  type: 'deposit' | 'withdraw',
  amount: number,
  memo: string,
  by: Actor,
) {
  const noteRef = doc(notesCol(), noteId)
  const fundRef = doc(fundsCol(), fundId)
  const txRef = doc(txCol())
  await runTransaction(requireDb(), async (tx) => {
    const [noteSnap, fundSnap] = await Promise.all([tx.get(noteRef), tx.get(fundRef)])
    if (!noteSnap.exists()) throw new Error('Ghi chú không còn.')
    if (!fundSnap.exists()) throw new Error('Quỹ không còn.')
    const fund = fundSnap.data()
    if (type === 'withdraw' && amount > (fund.balance ?? 0)) {
      throw new Error(`Số dư quỹ không đủ. ${fund.name} chỉ còn ${formatMoney(fund.balance ?? 0)}.`)
    }
    const now = Timestamp.now()
    const entry = { type, amount, fundId, fundName: fund.name ?? '', txId: txRef.id, byName: by.name, at: now }
    const items = uniqueItemIds((noteSnap.data().items ?? []) as NoteItem[]).map((i) => (i.id === itemId ? { ...i, money: [...(i.money ?? []), entry] } : i))
    tx.set(txRef, {
      fundId,
      type,
      amount,
      note: memo,
      date: now,
      noteId,
      noteItemId: itemId,
      createdAt: serverTimestamp(),
      createdBy: by.uid,
      createdByName: by.name,
    })
    tx.update(fundRef, { balance: increment(type === 'deposit' ? amount : -amount) })
    tx.update(noteRef, { items })
  })
}

// ids: id các ghi chú của người nhận theo thứ tự hiện tại (đánh số lại sau khi xoá).
// Xoá luôn thông báo của ghi chú (nếu có), vì ghi chú không còn để mở xem.
export async function deleteNote(noteId: string, ids: string[]) {
  const batch = writeBatch(requireDb())
  batch.delete(doc(notesCol(), noteId))
  batch.delete(doc(notificationsCol(), noteNoticeId(noteId)))
  renumberNotes(batch, ids.filter((x) => x !== noteId))
  await commit(batch.commit())
}

// ---- Thẻ ghi chú ----

// ids: id các thẻ hiện có theo thứ tự hiện tại; position: số thứ tự của thẻ mới (1-based)
export async function createCard(text: string, by: Actor, ids: string[], position: number) {
  const batch = writeBatch(requireDb())
  const ref = doc(noteCardsCol())
  const rest = insertAt(ids, ref.id, position)
  batch.set(ref, { text, position: rest.indexOf(ref.id) + 1, createdAt: serverTimestamp(), createdBy: by.uid })
  renumber(
    batch,
    rest.filter((x) => x !== ref.id),
    rest,
  )
  await commit(batch.commit())
}

export async function updateCardText(id: string, text: string) {
  await commit(updateDoc(doc(noteCardsCol(), id), { text }))
}

// Kéo thả / đổi số thứ tự: lưu thứ tự mới
export async function reorderCards(ids: string[]) {
  const batch = writeBatch(requireDb())
  renumber(batch, ids)
  await commit(batch.commit())
}

export async function deleteCard(id: string, ids: string[]) {
  const batch = writeBatch(requireDb())
  batch.delete(doc(noteCardsCol(), id))
  renumber(batch, ids.filter((x) => x !== id))
  await commit(batch.commit())
}

export async function saveNoteSettings(uid: string, settings: Partial<NoteSettings>) {
  await commit(setDoc(noteSettingsDoc(uid), settings, { merge: true }))
}
