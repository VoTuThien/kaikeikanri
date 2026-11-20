// Hòm thư của game Vườn mây (xem CLAUDE.md "Hòm thư"): thư do QUẢN TRỊ gửi bằng script `scripts/send-mail.mjs` (Admin SDK),
// người chơi chỉ đọc + bấm nhận quà (app không tạo thư được, Firestore Rules chặn).
// - Thư riêng: families/{familyId}/gardens/{uid}/mail/{mailId} — đã nhận thì `claimedAt` (người chơi chỉ sửa được trường này).
// - Thư chung: gardenBroadcasts/{id} — đã nhận ghi ở `mailClaimed[id]` của vườn; `newPlayers` = false thì chỉ vườn tạo TRƯỚC lúc gửi mới nhận.
import { collection, doc, limit, onSnapshot, orderBy, query, type DocumentData } from 'firebase/firestore'
import { requireDb } from '../../../lib/firestore'
import { familyKey, useLiveQuery } from '../../../lib/liveQuery'
import { familyCol } from '../../../lib/family'
import type { Reward } from './achievements'

export interface MailRewards extends Reward {
  seeds?: Record<string, number> // id cây -> số hạt
  insects?: Record<string, number> // id côn trùng -> số con
  pots?: string[] // id loại chậu (mỗi phần tử = 1 chậu cấp 1)
  charms?: Record<string, number> // bùa: B / A / S (may mắn), keep (giữ cấp)
  ferts?: Record<string, number> // phân bón B / A (số túi)
  shards?: Record<string, number> // mảnh vỡ sao: sao_sang / sao
}
export interface Mail {
  id: string
  broadcast: boolean
  title: string
  body: string
  from: string
  rewards: MailRewards
  createdAt: number // ms
  expiresAt: number | null
  claimedAt: number | null // thư riêng: lúc nhận; thư chung: lấy từ vườn
  newPlayers: boolean // thư chung: người chơi mới (vườn tạo sau lúc gửi) cũng nhận được
}

const ms = (v: unknown): number | null => (v && typeof (v as { toMillis?: () => number }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : typeof v === 'number' ? v : null)
export function toMail(id: string, d: DocumentData, broadcast: boolean): Mail {
  return {
    id,
    broadcast,
    title: d.title ?? '(không có tiêu đề)',
    body: d.body ?? '',
    from: d.from ?? 'Vườn mây',
    rewards: { ...(d.rewards ?? {}) },
    createdAt: ms(d.createdAt) ?? 0,
    expiresAt: ms(d.expiresAt),
    claimedAt: ms(d.claimedAt),
    newPlayers: !!d.newPlayers,
  }
}

export const MAIL_KEEP_MS = 30 * 24 * 3600 * 1000 // thư đã nhận giữ 30 ngày rồi ẩn
export const broadcastsCol = () => collection(requireDb(), 'gardenBroadcasts')
export const mailCol = (uid: string) => collection(doc(familyCol('gardens'), uid), 'mail')

// Thư chung có dành cho vườn này không (vườn tạo lúc `born`)
export const broadcastFor = (m: Mail, born: number) => m.newPlayers || !born || born <= m.createdAt

// Danh sách thư đang hiện (mới nhất trước) + số thư chưa nhận còn hạn; `claimed` = mailClaimed của vườn (thư chung)
export function mailView(personal: Mail[], broadcasts: Mail[], claimed: Record<string, number>, born: number, now: number) {
  const list = [
    ...personal,
    ...broadcasts.filter((m) => broadcastFor(m, born)).map((m) => ({ ...m, claimedAt: claimed[m.id] ?? null })),
  ]
    .filter((m) => (m.claimedAt ? now - m.claimedAt < MAIL_KEEP_MS : !m.expiresAt || m.expiresAt > now - MAIL_KEEP_MS))
    .sort((a, b) => b.createdAt - a.createdAt)
  const open = (m: Mail) => !m.claimedAt && (!m.expiresAt || m.expiresAt > now)
  return { list, unread: list.filter(open).length, open }
}

// Theo dõi realtime thư riêng + thư chung (50 thư mới nhất mỗi loại)
export function useMailbox(uid: string | null) {
  const personal = useLiveQuery<Mail[]>(uid ? familyKey('garden-mail', uid) : null, (on) =>
    onSnapshot(query(mailCol(uid!), orderBy('createdAt', 'desc'), limit(50)), (snap) =>
      on(snap.docs.map((d) => toMail(d.id, d.data(), false)), snap.metadata.fromCache),
    ),
  )
  const broadcasts = useLiveQuery<Mail[]>(uid ? familyKey('garden-broadcasts') : null, (on) =>
    onSnapshot(query(broadcastsCol(), orderBy('createdAt', 'desc'), limit(50)), (snap) =>
      on(snap.docs.map((d) => toMail(d.id, d.data(), true)), snap.metadata.fromCache),
    ),
  )
  return { personal: personal ?? [], broadcasts: broadcasts ?? [] }
}
