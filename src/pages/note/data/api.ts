import { doc, increment, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type WriteBatch } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { formatMoney } from '../../../lib/format'
import { fundsCol, txCol } from '../../fund/data/api'
import { sameKey, type NoteCard, type NoteItem, type NoteSettings } from './types'

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
  const items: NoteItem[] = texts.map((text, i) => ({ id: `i${i + 1}`, text, done: false, doneByName: '', money: [] }))
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
  addNewCards(batch, texts, cards, by)
  await commit(batch.commit())
}

/**
 * Sửa ghi chú: tên, số thứ tự (`ids` = các ghi chú của người nhận theo thứ tự hiện tại) và các thẻ nội dung
 * (`items` theo thứ tự mới; thẻ cũ giữ trạng thái đã xong). Thẻ có nội dung mới cũng được lưu vào Thẻ ghi chú.
 */
export async function updateNote(id: string, name: string, items: NoteItem[], by: Actor, cards: NoteCard[], ids: string[], position: number) {
  const batch = writeBatch(requireDb())
  const order = insertAt(
    ids.filter((x) => x !== id),
    id,
    position,
  )
  batch.update(doc(notesCol(), id), { name, items, position: order.indexOf(id) + 1 })
  renumberNotes(
    batch,
    order.filter((x) => x !== id),
    order,
  )
  addNewCards(
    batch,
    items.map((i) => i.text),
    cards,
    by,
  )
  await commit(batch.commit())
}

// Lưu các thẻ có nội dung mới vào Thẻ ghi chú, thêm vào cuối danh sách gợi ý
function addNewCards(batch: WriteBatch, texts: string[], cards: NoteCard[], by: Actor) {
  newTexts(texts, cards).forEach((text, i) => {
    batch.set(doc(noteCardsCol()), { text, position: cards.length + i + 1, createdAt: serverTimestamp(), createdBy: by.uid })
  })
}

// Đánh dấu 1 thẻ trong ghi chú là đã làm xong / chưa xong (đọc lại ghi chú trong transaction để không ghi đè thẻ khác)
export async function setItemDone(noteId: string, itemId: string, done: boolean, by: Actor) {
  const ref = doc(notesCol(), noteId)
  await commit(
    runTransaction(requireDb(), async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const items = ((snap.data().items ?? []) as NoteItem[]).map((i) =>
        i.id === itemId ? { ...i, done, doneByName: done ? by.name : '' } : i,
      )
      tx.update(ref, { items })
    }),
  )
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
    const items = ((noteSnap.data().items ?? []) as NoteItem[]).map((i) => (i.id === itemId ? { ...i, money: [...(i.money ?? []), entry] } : i))
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

// ids: id các ghi chú của người nhận theo thứ tự hiện tại (đánh số lại sau khi xoá)
export async function deleteNote(noteId: string, ids: string[]) {
  const batch = writeBatch(requireDb())
  batch.delete(doc(notesCol(), noteId))
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
