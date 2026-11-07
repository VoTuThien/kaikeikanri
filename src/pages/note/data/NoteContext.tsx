import { createContext, useContext, type ReactNode } from 'react'
import { doc, onSnapshot, orderBy, query, where, type DocumentData, type Timestamp } from 'firebase/firestore'
import type { Actor } from '../../../lib/firestore'
import { familyKey, useLiveQuery } from '../../../lib/liveQuery'
import { useFundList } from '../../fund/data/FundContext'
import type { Fund } from '../../fund/data/types'
import { noteCardsCol, noteSettingsDoc, notesCol } from './api'
import { DEFAULT_NOTE_SETTINGS, type Note, type NoteCard, type NoteItem, type NoteMoney, type NoteSettings } from './types'

interface NoteData {
  actor: Actor
  cards: NoteCard[] // thẻ ghi chú đã từng nhập, xếp theo số thứ tự (= thứ tự ưu tiên gợi ý)
  inbox: Note[] // ghi chú gửi đến mình, theo số thứ tự
  sent: Note[] // ghi chú mình gửi cho THÀNH VIÊN KHÁC (không tính tự ghi cho mình), mới nhất trước — chỉ xem
  funds: Fund[] // nhóm quỹ của gia đình (nạp / rút ở màn hình Xem ghi chú)
  settings: NoteSettings
  loading: boolean
}

const NoteContext = createContext<NoteData | null>(null)

const OPTS = { serverTimestamps: 'estimate' } as const

const toDate = (v: unknown) => (v ? (v as Timestamp).toDate() : null)

function toCard(id: string, d: DocumentData): NoteCard {
  return { id, text: d.text ?? '', position: d.position ?? Number.MAX_SAFE_INTEGER, createdAt: toDate(d.createdAt) }
}

// Xếp thẻ theo số thứ tự (trùng số thì theo lúc tạo), rồi đánh lại 1, 2, 3... cho liên tục
function sortCards(list: NoteCard[]): NoteCard[] {
  return [...list]
    .sort((a, b) => a.position - b.position || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
    .map((c, i) => ({ ...c, position: i + 1 }))
}

function toNote(id: string, d: DocumentData): Note {
  const items = ((d.items ?? []) as Partial<NoteItem>[]).map((i, n) => ({
    id: i.id ?? `i${n + 1}`,
    text: i.text ?? '',
    done: !!i.done,
    doneByName: i.doneByName ?? '',
    money: ((i.money ?? []) as (Omit<NoteMoney, 'at'> & { at?: unknown })[]).map((m) => ({ ...m, at: toDate(m.at) ?? new Date(0) })),
  }))
  return {
    id,
    name: d.name ?? '',
    position: d.position ?? Number.MAX_SAFE_INTEGER,
    toUid: d.toUid ?? '',
    toName: d.toName ?? '',
    fromUid: d.fromUid ?? '',
    fromName: d.fromName ?? '',
    items,
    createdAt: toDate(d.createdAt),
  }
}

// Xếp ghi chú theo số thứ tự (ghi chú cũ chưa có số thì xếp sau, mới nhất trước), rồi đánh lại 1, 2, 3... cho liên tục
function sortNotes(list: Note[]): Note[] {
  return [...list]
    .sort((a, b) => a.position - b.position || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .map((n, i) => ({ ...n, position: i + 1 }))
}

// Các ghi chú gửi đến 1 thành viên, xếp theo số thứ tự, realtime. null = đang tải.
// Chỉ lọc theo người nhận (không cần tạo chỉ mục ghép trên Firestore), xếp ở máy.
export function useNotesTo(uid: string | undefined): Note[] | null {
  return useLiveQuery<Note[]>(uid ? familyKey('notes', 'to', uid) : null, (on) =>
    onSnapshot(query(notesCol(), where('toUid', '==', uid)), (snap) =>
      on(sortNotes(snap.docs.map((d) => toNote(d.id, d.data(OPTS)))), snap.metadata.fromCache),
    ),
  )
}

// Các ghi chú 1 thành viên đã gửi cho thành viên KHÁC (bỏ ghi chú tự ghi cho mình), mới nhất trước, realtime. null = đang tải.
export function useNotesFrom(uid: string | undefined): Note[] | null {
  return useLiveQuery<Note[]>(uid ? familyKey('notes', 'from', uid) : null, (on) =>
    onSnapshot(query(notesCol(), where('fromUid', '==', uid)), (snap) =>
      on(
        snap.docs
          .map((d) => toNote(d.id, d.data(OPTS)))
          .filter((n) => n.toUid !== uid)
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
        snap.metadata.fromCache,
      ),
    ),
  )
}

// 1 ghi chú theo id, realtime (màn hình sửa ghi chú). undefined = đang tải, null = không còn (đã bị xoá).
export function useNoteDoc(id: string | undefined): Note | null | undefined {
  const value = useLiveQuery<{ note: Note | null }>(id ? familyKey('note', id) : null, (on) =>
    onSnapshot(doc(notesCol(), id!), (snap) =>
      on({ note: snap.exists() ? toNote(snap.id, snap.data(OPTS)) : null }, snap.metadata.fromCache),
    ),
  )
  return value ? value.note : undefined
}

export function NoteProvider({ actor, children }: { actor: Actor | null; children: ReactNode }) {
  const uid = actor?.uid

  // Dữ liệu realtime có nhớ tạm (liveQuery): mở lại app / vuốt qua lại thì hiện ngay, không chớp skeleton
  const cards = useLiveQuery<NoteCard[]>(uid ? familyKey('noteCards') : null, (on) =>
    onSnapshot(query(noteCardsCol(), orderBy('createdAt', 'asc')), (snap) =>
      on(sortCards(snap.docs.map((d) => toCard(d.id, d.data(OPTS)))), snap.metadata.fromCache),
    ),
  )
  const inbox = useNotesTo(uid)
  const sent = useNotesFrom(uid)
  const funds = useFundList(uid)
  const settings = useLiveQuery<NoteSettings>(uid ? `user:${uid}:noteSettings` : null, (on) =>
    onSnapshot(noteSettingsDoc(uid!), (snap) => on({ ...DEFAULT_NOTE_SETTINGS, ...snap.data() }, snap.metadata.fromCache)),
  )

  const value: NoteData = {
    actor: actor ?? { uid: '', name: '' },
    cards: cards ?? [],
    inbox: inbox ?? [],
    sent: sent ?? [],
    funds: funds ?? [],
    settings: settings ?? DEFAULT_NOTE_SETTINGS,
    loading: !uid || !cards || !inbox || !sent || !funds || !settings,
  }
  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>
}

export function useNote() {
  const ctx = useContext(NoteContext)
  if (!ctx) throw new Error('useNote phải được dùng bên trong NoteProvider')
  return ctx
}
