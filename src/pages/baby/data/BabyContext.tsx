import { createContext, useContext, useState, type ReactNode } from 'react'
import { onSnapshot, orderBy, query, Timestamp, where, type DocumentData } from 'firebase/firestore'
import { useFamily } from '../../../contexts/FamilyContext'
import type { Actor } from '../../../lib/firestore'
import { familyKey, useLiveQuery } from '../../../lib/liveQuery'
import { cardsCol, childrenCol, entriesCol } from './api'
import { addMinutes, startOfDay, type BabyCard, type BabyEntry, type Child } from './types'

interface BabyData {
  actor: Actor
  cards: BabyCard[]
  children: Child[] // các con của gia đình, theo thứ tự thêm
  child: Child | null // con đang chọn (time line / thống kê / màn hình chính của app hiện theo con này); null = chưa thêm con
  selectChild: (id: string) => void
  loading: boolean
}

const BabyContext = createContext<BabyData | null>(null)

const OPTS = { serverTimestamps: 'estimate' } as const

const toDate = (v: unknown) => (v ? (v as Timestamp).toDate() : null)

function toCard(id: string, d: DocumentData): BabyCard {
  return {
    id,
    name: d.name ?? '',
    icon: d.icon ?? '🍼',
    color: d.color ?? 'from-amber-400 to-orange-500',
    defaultMinutes: d.defaultMinutes ?? 30,
    createdAt: toDate(d.createdAt),
  }
}

function toChild(id: string, d: DocumentData): Child {
  return {
    id,
    name: d.name ?? '',
    birthDate: d.birthDate ?? '',
    birthTime: d.birthTime ?? null,
    gender: d.gender === 'female' ? 'female' : 'male',
    avatar: d.avatar ?? '👶',
    photo: d.photo ?? null,
    createdAt: toDate(d.createdAt),
  }
}

// Con đang chọn được nhớ theo gia đình (trên máy này)
const childKey = (familyId: string) => `baby-child:${familyId}`
function readChild(familyId: string | undefined) {
  try {
    return familyId ? localStorage.getItem(childKey(familyId)) : null
  } catch {
    return null
  }
}

function toEntry(id: string, d: DocumentData): BabyEntry {
  const start = toDate(d.start) ?? new Date()
  // Chưa hoàn thành thì không có số phút / kết thúc
  const minutes: number | null = typeof d.minutes === 'number' ? d.minutes : null
  return {
    id,
    cardId: d.cardId ?? '',
    name: d.name ?? '',
    icon: d.icon ?? '🍼',
    color: d.color ?? 'from-amber-400 to-orange-500',
    start,
    minutes,
    end: toDate(d.end) ?? (minutes === null ? null : addMinutes(start, minutes)),
    createdByName: d.createdByName ?? '',
    childId: d.childId ?? null,
  }
}

export function BabyProvider({ actor, children }: { actor: Actor | null; children: ReactNode }) {
  const familyId = useFamily().current?.familyId
  const [selectedId, setSelectedId] = useState(() => readChild(familyId))
  const uid = actor?.uid

  // Dữ liệu realtime có nhớ tạm (liveQuery): mở lại app / vuốt qua lại thì hiện ngay, không chớp skeleton
  const cards = useLiveQuery<BabyCard[]>(uid ? familyKey('babyCards') : null, (on) =>
    onSnapshot(query(cardsCol(), orderBy('createdAt', 'asc')), (snap) =>
      on(snap.docs.map((d) => toCard(d.id, d.data(OPTS))), snap.metadata.fromCache),
    ),
  )
  const kids = useLiveQuery<Child[]>(uid ? familyKey('children') : null, (on) =>
    onSnapshot(query(childrenCol(), orderBy('createdAt', 'asc')), (snap) =>
      on(snap.docs.map((d) => toChild(d.id, d.data(OPTS))), snap.metadata.fromCache),
    ),
  )

  function selectChild(id: string) {
    setSelectedId(id)
    try {
      if (familyId) localStorage.setItem(childKey(familyId), id)
    } catch {
      // Không lưu được thì lần sau chọn con đầu tiên
    }
  }

  const list = kids ?? []
  // Con đang chọn: lựa chọn lần trước (nếu còn), không thì con đầu tiên
  const child = list.find((c) => c.id === selectedId) ?? list[0] ?? null
  const value: BabyData = {
    actor: actor ?? { uid: '', name: '' },
    cards: cards ?? [],
    children: list,
    child,
    selectChild,
    loading: !uid || !cards || !kids,
  }
  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>
}

export function useBaby() {
  const ctx = useContext(BabyContext)
  if (!ctx) throw new Error('useBaby phải được dùng bên trong BabyProvider')
  return ctx
}

// Các hoạt động của CON ĐANG CHỌN bắt đầu trong 1 ngày (theo giờ máy), xếp theo giờ bắt đầu. null = đang tải.
// Hoạt động cũ chưa gắn con (childId = null) được tính là của con đầu tiên.
export function useDayEntries(day: Date): BabyEntry[] | null {
  const { actor, children, child } = useBaby()
  const key = startOfDay(day).getTime()
  const all = useLiveQuery<BabyEntry[]>(actor.uid ? familyKey('babyEntries', key) : null, (on) => {
    const from = new Date(key)
    const to = addMinutes(from, 24 * 60)
    return onSnapshot(
      query(entriesCol(), where('start', '>=', Timestamp.fromDate(from)), where('start', '<', Timestamp.fromDate(to)), orderBy('start', 'asc')),
      (snap) => on(snap.docs.map((d) => toEntry(d.id, d.data())), snap.metadata.fromCache),
    )
  })

  if (!all) return null
  const firstId = children[0]?.id ?? null
  const childId = child?.id ?? null
  return all.filter((e) => (e.childId ?? firstId) === childId)
}
