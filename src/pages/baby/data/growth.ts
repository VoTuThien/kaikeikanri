import { addDoc, deleteDoc, deleteField, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type DocumentData, type Timestamp } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { commit, type Actor } from '../../../lib/firestore'
import { familyKey, useLiveQuery } from '../../../lib/liveQuery'
import { useBaby } from './BabyContext'

// Màn hình Phát triển của app Chăm con: mỗi thẻ = 1 lần ghi chiều cao / cân nặng / vắc xin của 1 con.
//   families/{familyId}/growth/{id}  { childId, date "YYYY-MM-DD", height (cm) | null, weight (kg) | null, vaccines: string[] ([] = không tiêm), createdAt, createdBy, createdByName }
//   (dữ liệu cũ có 1 chuỗi `vaccine` thay cho mảng `vaccines`: đọc vẫn được, sửa lại thì chuyển sang `vaccines`)

export interface GrowthInput {
  childId: string
  date: string // "YYYY-MM-DD"
  height: number | null // cm, null = không đo
  weight: number | null // kg, null = không cân
  vaccines: string[] // các vắc xin đã tiêm trong ngày (1 ngày tiêm được nhiều mũi); [] = hôm đó không tiêm
}

export interface GrowthRecord extends GrowthInput {
  id: string
  createdAt: Date | null
  createdByName: string
}

export const growthCol = () => familyCol('growth')

const OPTS = { serverTimestamps: 'estimate' } as const

function toRecord(id: string, d: DocumentData): GrowthRecord {
  return {
    id,
    childId: d.childId ?? '',
    date: d.date ?? '',
    height: typeof d.height === 'number' ? d.height : null,
    weight: typeof d.weight === 'number' ? d.weight : null,
    vaccines: Array.isArray(d.vaccines) ? (d.vaccines as string[]).filter(Boolean) : d.vaccine ? [d.vaccine as string] : [],
    createdAt: d.createdAt ? (d.createdAt as Timestamp).toDate() : null,
    createdByName: d.createdByName ?? '',
  }
}

// Mọi thẻ của gia đình (realtime, có nhớ tạm), mới nhất trước. null = đang tải.
export function useAllGrowth(): GrowthRecord[] | null {
  const { actor } = useBaby()
  return useLiveQuery<GrowthRecord[]>(actor.uid ? familyKey('growth') : null, (on) =>
    onSnapshot(query(growthCol(), orderBy('date', 'desc')), (snap) =>
      on(
        snap.docs
          .map((d) => toRecord(d.id, d.data(OPTS)))
          // Cùng ngày thì thẻ ghi sau đứng trước
          .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
        snap.metadata.fromCache,
      ),
    ),
  )
}

// Các thẻ của CON ĐANG CHỌN. null = đang tải.
export function useChildGrowth(): GrowthRecord[] | null {
  const { child } = useBaby()
  const all = useAllGrowth()
  if (!all) return null
  return child ? all.filter((r) => r.childId === child.id) : []
}

export async function createGrowth(input: GrowthInput, by: Actor) {
  await commit(addDoc(growthCol(), { ...input, createdAt: serverTimestamp(), createdBy: by.uid, createdByName: by.name }))
}

export async function updateGrowth(id: string, input: GrowthInput) {
  // Bỏ trường `vaccine` (1 chuỗi) của dữ liệu cũ, giờ dùng mảng `vaccines`
  await commit(updateDoc(doc(growthCol(), id), { ...input, vaccine: deleteField() }))
}

export async function deleteGrowth(id: string) {
  await commit(deleteDoc(doc(growthCol(), id)))
}

// ---- Nhập / hiển thị số đo ----

// "75,5" / "75.5" -> 75.5; trống -> null; sai -> NaN
export function parseMeasure(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

// Số đo hiển thị kiểu Việt Nam: 75.5 -> "75,5"
export const formatMeasure = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

// Số đo -> chữ trong ô nhập (dấu phẩy thập phân)
export const measureText = (n: number | null) => (n === null ? '' : formatMeasure(n).replace(/\./g, ''))

export const HEIGHT_RANGE = { min: 20, max: 250 } // cm
export const WEIGHT_RANGE = { min: 0.5, max: 200 } // kg

// "YYYY-MM-DD" -> Date (theo giờ máy)
export function dateOf(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

// Tuổi của con vào ngày thực hiện, tính theo THÁNG: "15 ngày tuổi", "8 tháng 12 ngày tuổi", "2 tuổi 3 tháng (27 tháng tuổi)".
// "" = chưa có ngày sinh hoặc ngày thực hiện trước ngày sinh.
export function ageAtDate(birthDate: string, date: string): string {
  if (!birthDate || !date) return ''
  const birth = dateOf(birthDate)
  const at = dateOf(date)
  if (at < birth) return ''
  let months = (at.getFullYear() - birth.getFullYear()) * 12 + (at.getMonth() - birth.getMonth())
  if (at.getDate() < birth.getDate()) months--
  const anchor = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate())
  const days = Math.max(0, Math.round((at.getTime() - anchor.getTime()) / 86400000))
  if (months <= 0) return `${Math.round((at.getTime() - birth.getTime()) / 86400000)} ngày tuổi`
  if (months < 24) return `${months} tháng${days ? ` ${days} ngày` : ''} tuổi`
  return `${Math.floor(months / 12)} tuổi${months % 12 ? ` ${months % 12} tháng` : ''} (${months} tháng tuổi)`
}

// Gọn danh sách vắc xin nhập vào: bỏ ô trống, khoảng trắng thừa, tên trùng (không phân biệt hoa thường)
export function cleanVaccines(list: string[]): string[] {
  const seen = new Set<string>()
  return list
    .map((v) => v.trim().replace(/\s+/g, ' '))
    .filter((v) => {
      const k = v.toLowerCase()
      if (!v || seen.has(k)) return false
      seen.add(k)
      return true
    })
}

const pad = (n: number) => String(n).padStart(2, '0')
export const todayText = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
