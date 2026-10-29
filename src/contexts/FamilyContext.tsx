import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onSnapshot, orderBy, query, type DocumentData, type Timestamp } from 'firebase/firestore'
import { setActiveFamily } from '../lib/family'
import { myFamiliesCol, mySentRequestsCol, requestsCol, type JoinRequest } from '../pages/family/data/api'
import { useAuth } from './AuthContext'

export interface MyFamily {
  familyId: string
  name: string
  code: string
  role: 'owner' | 'member'
}

export interface SentRequest {
  familyId: string
  name: string
  createdAt: Date | null
}

interface FamilyData {
  families: MyFamily[] // các gia đình mình là thành viên
  current: MyFamily | null // gia đình đang chọn ở màn hình chính
  selectFamily: (familyId: string) => void
  owned: MyFamily | null // gia đình mình tạo (mỗi người tối đa 1)
  requests: JoinRequest[] // yêu cầu xin gia nhập gia đình mình tạo, cập nhật realtime (chuông thông báo)
  sentRequests: SentRequest[] // yêu cầu mình đã gửi, đang chờ duyệt
  loading: boolean
}

const FamilyContext = createContext<FamilyData | null>(null)

const toDate = (v: unknown) => (v ? (v as Timestamp).toDate() : null)
const storageKey = (uid: string) => `family:${uid}`

function readStored(uid: string) {
  try {
    return localStorage.getItem(storageKey(uid))
  } catch {
    return null
  }
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [families, setFamilies] = useState<MyFamily[] | null>(null)
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([])
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Danh sách gia đình + yêu cầu đã gửi của mình (realtime: được duyệt là gia đình mới hiện ngay)
  useEffect(() => {
    setFamilies(null)
    setSelectedId(uid ? readStored(uid) : null)
    if (!uid) return
    const unsubs = [
      onSnapshot(query(myFamiliesCol(uid), orderBy('joinedAt', 'asc')), (snap) =>
        setFamilies(
          snap.docs.map((d) => {
            const v: DocumentData = d.data({ serverTimestamps: 'estimate' })
            return { familyId: d.id, name: v.name ?? '', code: v.code ?? '', role: v.role === 'owner' ? 'owner' : 'member' }
          }),
        ),
      ),
      onSnapshot(mySentRequestsCol(uid), (snap) =>
        setSentRequests(snap.docs.map((d) => ({ familyId: d.id, name: d.data().name ?? '', createdAt: toDate(d.data().createdAt) }))),
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [uid])

  const owned = families?.find((f) => f.role === 'owner') ?? null

  // Yêu cầu xin gia nhập gia đình mình tạo: realtime cho chuông thông báo
  const ownedId = owned?.familyId
  useEffect(() => {
    setRequests([])
    if (!ownedId) return
    return onSnapshot(query(requestsCol(ownedId), orderBy('createdAt', 'asc')), (snap) =>
      setRequests(
        snap.docs.map((d) => {
          const v = d.data({ serverTimestamps: 'estimate' })
          return { uid: d.id, name: v.name ?? '', email: v.email ?? '', createdAt: toDate(v.createdAt) }
        }),
      ),
    )
  }, [ownedId])

  // Gia đình đang chọn: lựa chọn lần trước (nếu vẫn là thành viên), không thì gia đình đầu tiên
  const current = families?.find((f) => f.familyId === selectedId) ?? families?.[0] ?? null
  // Đặt ngay trong lúc render (không đợi effect) để các Provider của app con, vốn subscribe trong effect
  // của chính chúng (chạy trước effect của cha), luôn thấy đúng gia đình.
  setActiveFamily(current?.familyId ?? null)

  function selectFamily(familyId: string) {
    setSelectedId(familyId)
    if (!uid) return
    try {
      localStorage.setItem(storageKey(uid), familyId)
    } catch {
      // Không lưu được thì lần sau mở app sẽ chọn gia đình đầu tiên
    }
  }

  const value: FamilyData = {
    families: families ?? [],
    current,
    selectFamily,
    owned,
    requests,
    sentRequests,
    loading: !!uid && families === null,
  }
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

export function useFamily() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily phải được dùng bên trong FamilyProvider')
  return ctx
}
