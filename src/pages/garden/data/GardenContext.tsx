import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onSnapshot } from 'firebase/firestore'
import type { Actor } from '../../../lib/firestore'
import { familyKey, useLiveQuery } from '../../../lib/liveQuery'
import { createGarden, gardenDoc, toGarden, type Garden } from './api'

interface GardenData {
  actor: Actor
  garden: Garden | null // null = đang tải / đang tạo vườn mới
  loading: boolean
}

const GardenContext = createContext<GardenData | null>(null)

export function GardenProvider({ actor, children }: { actor: Actor | null; children: ReactNode }) {
  const uid = actor?.uid
  // { garden: null } = chưa có vườn (lần đầu chơi); `cached` = dữ liệu từ bộ nhớ máy, chưa chắc đúng với server
  const value = useLiveQuery<{ garden: Garden | null; cached: boolean }>(uid ? familyKey('garden', uid) : null, (on) =>
    onSnapshot(gardenDoc(uid!), (snap) =>
      on({ garden: snap.exists() ? toGarden(snap.data()) : null, cached: snap.metadata.fromCache }, snap.metadata.fromCache),
    ),
  )

  // Lần đầu chơi: tạo vườn mới (chỉ khi server xác nhận là chưa có, tránh ghi đè lúc đang đọc từ bộ nhớ máy)
  const [creating, setCreating] = useState(false)
  const missing = value !== null && value.garden === null && !value.cached
  useEffect(() => {
    if (!missing || creating || !actor) return
    setCreating(true)
    createGarden(actor)
      .catch((err) => console.error('Tạo vườn thất bại', err))
      .finally(() => setCreating(false))
  }, [missing, creating, actor])

  const garden = value?.garden ?? null
  const data: GardenData = { actor: actor ?? { uid: '', name: '' }, garden, loading: !uid || !garden }
  return <GardenContext.Provider value={data}>{children}</GardenContext.Provider>
}

export function useGarden() {
  const ctx = useContext(GardenContext)
  if (!ctx) throw new Error('useGarden phải được dùng bên trong GardenProvider')
  return ctx
}

// Đồng hồ cho các ô đất: render lại mỗi `ms` để thời gian / giai đoạn cây cập nhật
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}
