import { addDoc, deleteDoc, deleteField, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type DocumentData, type Timestamp } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { commit, type Actor } from '../../../lib/firestore'
import { familyKey, useLiveQuery } from '../../../lib/liveQuery'
import { useBaby } from './BabyContext'

// Màn hình Phát triển của app Chăm con: mỗi thẻ = 1 lần ghi chiều cao / cân nặng / vắc xin của 1 con.
//   families/{familyId}/growth/{id}  { childId, date "YYYY-MM-DD", height (cm) | null, weight (kg) | null, vaccines: VaccineShot[] ([] = không tiêm), createdAt, createdBy, createdByName }
//   (dữ liệu cũ: `vaccines` là mảng tên, hoặc 1 chuỗi `vaccine` — đọc thành mũi tiêm chỉ có tên vaccine; sửa lại thì lưu theo dạng mới)

export interface GrowthInput {
  childId: string
  date: string // "YYYY-MM-DD"
  height: number | null // cm, null = không đo
  weight: number | null // kg, null = không cân
  vaccines: VaccineShot[] // các mũi vắc xin tiêm trong ngày (1 ngày tiêm được nhiều mũi); [] = hôm đó không tiêm
}

// 1 mũi vắc xin: phòng bệnh gì, tên vaccine, mũi thứ mấy (vd 6 in 1 có 3 mũi), giá (VND, 0 = miễn phí / không ghi), nơi tiêm
export interface VaccineShot {
  disease: string // phòng bệnh, vd "Lao", "Viêm gan B", "6 in 1"
  name: string // tên vaccine, vd "BCG", "Hexaxim (Pháp)"
  dose: number | null // mũi thứ mấy; null = không ghi
  price: number // giá, VND
  place: string // nơi tiêm, vd "BV Hùng Vương"
}

// Đọc 1 mũi tiêm (dữ liệu cũ chỉ có tên dạng chuỗi)
function toShot(v: unknown): VaccineShot | null {
  if (typeof v === 'string') return v.trim() ? { disease: '', name: v, dose: null, price: 0, place: '' } : null
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  return {
    disease: String(o.disease ?? ''),
    name: String(o.name ?? ''),
    dose: typeof o.dose === 'number' ? o.dose : null,
    price: typeof o.price === 'number' ? o.price : 0,
    place: String(o.place ?? ''),
  }
}

// "Lao (BCG) · mũi 1"
export function shotLabel(v: VaccineShot) {
  const main = v.disease && v.name ? `${v.disease} (${v.name})` : v.disease || v.name
  return `${main}${v.dose ? ` · mũi ${v.dose}` : ''}`
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
    vaccines: (Array.isArray(d.vaccines) ? (d.vaccines as unknown[]) : d.vaccine ? [d.vaccine] : []).map(toShot).filter((v): v is VaccineShot => !!v),
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

// Gọn danh sách mũi tiêm nhập vào: bỏ khoảng trắng thừa, bỏ mũi không có cả phòng bệnh lẫn tên vaccine
export function cleanShots(list: VaccineShot[]): VaccineShot[] {
  const tidy = (t: string) => t.trim().replace(/\s+/g, ' ')
  return list
    .map((v) => ({ ...v, disease: tidy(v.disease), name: tidy(v.name), place: tidy(v.place) }))
    .filter((v) => v.disease || v.name)
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Mũi thứ mấy của bệnh này: số mũi cùng phòng bệnh đã tiêm TRƯỚC ngày `date` (các thẻ khác của con) + 1
export function nextDose(records: GrowthRecord[], disease: string, date: string, exceptId?: string) {
  if (!disease.trim()) return null
  const before = records.filter((r) => r.id !== exceptId && r.date < date).flatMap((r) => r.vaccines.filter((v) => same(v.disease, disease)))
  return before.length + 1
}

// Lần tiêm gần nhất của bệnh này (để điền sẵn tên vaccine / giá / nơi tiêm)
export function lastShot(records: GrowthRecord[], disease: string, exceptId?: string) {
  const list = records
    .filter((r) => r.id !== exceptId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((r) => r.vaccines.filter((v) => same(v.disease, disease)))
  return list[0] ?? null
}

const pad = (n: number) => String(n).padStart(2, '0')
export const todayText = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
