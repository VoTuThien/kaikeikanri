import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onSnapshot, orderBy, query, Timestamp, where, type DocumentData } from 'firebase/firestore'
import type { Actor } from '../../../lib/firestore'
import { cardsCol, entriesCol } from './api'
import { addMinutes, startOfDay, type BabyCard, type BabyEntry } from './types'

interface BabyData {
  actor: Actor
  cards: BabyCard[]
  loading: boolean
}

const BabyContext = createContext<BabyData | null>(null)

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
  }
}

export function BabyProvider({ actor, children }: { actor: Actor | null; children: ReactNode }) {
  const [cards, setCards] = useState<BabyCard[] | null>(null)
  const uid = actor?.uid

  useEffect(() => {
    if (!uid) return
    return onSnapshot(query(cardsCol(), orderBy('createdAt', 'asc')), (snap) =>
      setCards(snap.docs.map((d) => toCard(d.id, d.data({ serverTimestamps: 'estimate' })))),
    )
  }, [uid])

  const value: BabyData = { actor: actor ?? { uid: '', name: '' }, cards: cards ?? [], loading: !uid || !cards }
  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>
}

export function useBaby() {
  const ctx = useContext(BabyContext)
  if (!ctx) throw new Error('useBaby phải được dùng bên trong BabyProvider')
  return ctx
}

// Các hoạt động bắt đầu trong 1 ngày (theo giờ máy), xếp theo giờ bắt đầu. null = đang tải.
export function useDayEntries(day: Date): BabyEntry[] | null {
  const { actor } = useBaby()
  const [entries, setEntries] = useState<BabyEntry[] | null>(null)
  const key = startOfDay(day).getTime()

  useEffect(() => {
    if (!actor.uid) return
    setEntries(null)
    const from = new Date(key)
    const to = addMinutes(from, 24 * 60)
    return onSnapshot(
      query(entriesCol(), where('start', '>=', Timestamp.fromDate(from)), where('start', '<', Timestamp.fromDate(to)), orderBy('start', 'asc')),
      (snap) => setEntries(snap.docs.map((d) => toEntry(d.id, d.data()))),
    )
  }, [actor.uid, key])

  return entries
}
