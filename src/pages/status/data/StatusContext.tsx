import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { onSnapshot, orderBy, query, type DocumentData, type Timestamp } from 'firebase/firestore'
import type { Actor } from '../../../lib/firestore'
import { placesCol, presenceCol, setMyPlace } from './api'
import { decidePlace, type Fix } from './presence'
import type { Place, Presence } from './types'

// Tình trạng lấy vị trí của máy đang dùng (chỉ hiển thị, không lưu lên server)
export type GpsState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'ok'; accuracy: number; at: Date; nearest: { name: string; distance: number } | null }
  | { kind: 'inaccurate'; accuracy: number; at: Date }
  | { kind: 'denied' }
  | { kind: 'error' }
  | { kind: 'unsupported' }

interface StatusData {
  actor: Actor
  places: Place[]
  presences: Presence[]
  loading: boolean
  gps: GpsState
  // Lấy vị trí ngay và chuyển tag luôn (không chờ lần đo thứ 2)
  refreshLocation: () => void
}

const StatusContext = createContext<StatusData | null>(null)

const toDate = (v: unknown) => (v ? (v as Timestamp).toDate() : null)

function toPlace(id: string, d: DocumentData): Place {
  return {
    id,
    name: d.name ?? '',
    type: d.type ?? 'house',
    lat: d.lat ?? 0,
    lng: d.lng ?? 0,
    note: d.note ?? '',
    cell: d.cell ?? null,
    createdAt: toDate(d.createdAt),
  }
}

function toPresence(id: string, d: DocumentData): Presence {
  return { uid: id, name: d.name ?? '', placeId: d.placeId ?? null, since: toDate(d.since) }
}

const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }

export function StatusProvider({ actor, children }: { actor: Actor | null; children: ReactNode }) {
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [presences, setPresences] = useState<Presence[] | null>(null)
  const [gps, setGps] = useState<GpsState>({ kind: 'idle' })
  const uid = actor?.uid

  useEffect(() => {
    if (!uid) return
    const opts = { serverTimestamps: 'estimate' } as const
    const unsubs = [
      onSnapshot(query(placesCol(), orderBy('createdAt', 'asc')), (snap) =>
        setPlaces(snap.docs.map((d) => toPlace(d.id, d.data(opts)))),
      ),
      onSnapshot(presenceCol(), (snap) => setPresences(snap.docs.map((d) => toPresence(d.id, d.data(opts))))),
    ]
    return () => unsubs.forEach((u) => u())
  }, [uid])

  // ----- Theo dõi vị trí (cách A: chỉ khi đang mở app Trạng thái) -----
  // Dùng ref để hàm nhận vị trí luôn đọc dữ liệu mới nhất mà không phải đăng ký lại GPS
  const latest = useRef({ places: [] as Place[], myPlaceId: null as string | null, actor, pending: null as string | null })
  latest.current.places = places ?? []
  latest.current.myPlaceId = presences?.find((p) => p.uid === uid)?.placeId ?? null
  latest.current.actor = actor

  const handleFix = useCallback((fix: Fix, force: boolean) => {
    const s = latest.current
    const decision = decidePlace(s.places, s.myPlaceId, fix, s.pending, force)
    const at = new Date()
    if (decision.action === 'inaccurate') {
      setGps({ kind: 'inaccurate', accuracy: fix.accuracy, at })
      return
    }
    if (decision.action === 'pending') s.pending = decision.placeId
    else s.pending = null
    if (decision.action === 'switch' && s.actor) {
      s.myPlaceId = decision.placeId // tránh ghi trùng khi 2 lần đo đến sát nhau
      setMyPlace(s.actor, decision.placeId).catch((e) => console.error('Cập nhật trạng thái thất bại', e))
    }
    const nearest = decision.action === 'stay' ? decision.nearest : null
    setGps({
      kind: 'ok',
      accuracy: fix.accuracy,
      at,
      nearest: nearest ? { name: nearest.place.name, distance: nearest.distance } : null,
    })
  }, [])

  const handleError = useCallback((err: GeolocationPositionError) => {
    setGps(err.code === err.PERMISSION_DENIED ? { kind: 'denied' } : { kind: 'error' })
  }, [])

  const toFix = (pos: GeolocationPosition): Fix => ({
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  })

  const ready = !!uid && places !== null && presences !== null
  useEffect(() => {
    if (!ready) return
    if (!navigator.geolocation) {
      setGps({ kind: 'unsupported' })
      return
    }
    setGps({ kind: 'locating' })
    const id = navigator.geolocation.watchPosition((pos) => handleFix(toFix(pos), false), handleError, GEO_OPTIONS)
    return () => navigator.geolocation.clearWatch(id)
  }, [ready, handleFix, handleError])

  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) return setGps({ kind: 'unsupported' })
    setGps({ kind: 'locating' })
    navigator.geolocation.getCurrentPosition((pos) => handleFix(toFix(pos), true), handleError, { ...GEO_OPTIONS, maximumAge: 0 })
  }, [handleFix, handleError])

  const value: StatusData = {
    actor: actor ?? { uid: '', name: '' },
    places: places ?? [],
    presences: presences ?? [],
    loading: !ready,
    gps,
    refreshLocation,
  }
  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>
}

export function useStatus() {
  const ctx = useContext(StatusContext)
  if (!ctx) throw new Error('useStatus phải được dùng bên trong StatusProvider')
  return ctx
}
