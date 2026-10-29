import { addDoc, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import type { Cell, PlaceInput } from './types'

// Cấu trúc dữ liệu trên Firestore:
//   families/{familyId}/places/{placeId}   địa điểm (chỉ thành viên gia đình xem / sửa được)
//   families/{familyId}/presence/{uid}     thành viên đang ở địa điểm nào (mỗi người chỉ sửa được bản ghi của mình)

export const placesCol = () => familyCol('places')
export const presenceCol = () => familyCol('presence')

// Ghi địa điểm hiện tại của người dùng (chỉ gọi khi địa điểm thay đổi để đỡ tốn lượt ghi)
export async function setMyPlace(by: Actor, placeId: string | null) {
  await commit(
    setDoc(doc(presenceCol(), by.uid), { uid: by.uid, name: by.name, placeId, since: serverTimestamp(), updatedAt: serverTimestamp() }),
  )
}

export async function createPlace(input: PlaceInput, by: Actor) {
  await commit(addDoc(placesCol(), { ...input, cell: null, createdAt: serverTimestamp(), createdBy: by.uid }))
}

export async function updatePlace(id: string, input: PlaceInput) {
  await commit(updateDoc(doc(placesCol(), id), { ...input }))
}

export async function deletePlace(id: string) {
  await commit(deleteDoc(doc(placesCol(), id)))
}

// Đặt địa điểm vào 1 ô của bản đồ mini; cell = null là gỡ khỏi bản đồ
export async function setPlaceCell(id: string, cell: Cell | null) {
  await commit(updateDoc(doc(placesCol(), id), { cell }))
}

// Đổi chỗ 2 địa điểm (cùng lúc, để không có lúc 2 mô hình chung 1 ô)
export async function swapPlaceCells(a: { id: string; cell: Cell | null }, b: { id: string; cell: Cell | null }) {
  const batch = writeBatch(requireDb())
  batch.update(doc(placesCol(), a.id), { cell: a.cell })
  batch.update(doc(placesCol(), b.id), { cell: b.cell })
  await commit(batch.commit())
}

// "10.776889, 106.700806" (dạng copy từ Google Maps) -> { lat, lng }; sai định dạng thì trả về null
export function parseCoords(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export const formatCoords = (lat: number, lng: number) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`
