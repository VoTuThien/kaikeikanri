import { addDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, writeBatch, type DocumentData, type Timestamp } from 'firebase/firestore'
import { familyCol } from '../../../lib/family'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { familyKey, useLiveQuery } from '../../../lib/liveQuery'
import { useBaby } from './BabyContext'
import { dateOf, todayText } from './growth'

// Ăn dặm — DANH SÁCH THỰC PHẨM ĐÃ THỬ của từng con (/baby/foods):
//   families/{familyId}/babyFoods/{id}  { childId, name, group, allergen, firstTried "YYYY-MM-DD" | null, status, reaction, createdAt, createdByName }
// status: trying = đang thử (theo dõi 3 ngày), ok = ăn được, reaction = có phản ứng (dị ứng, nổi mẩn, tiêu chảy…)
// Quy tắc thử món mới 3 ngày: mỗi lần chỉ thử 1 món mới, theo dõi 3 ngày rồi mới thử món khác.

export type FoodStatus = 'trying' | 'ok' | 'reaction'

export interface FoodInput {
  childId: string
  name: string
  group: string // nhóm thực phẩm (FOOD_GROUPS)
  allergen: boolean // thuộc nhóm dễ dị ứng (trứng, tôm cua, đậu phộng, sữa bò…)
  firstTried: string | null // ngày thử lần đầu "YYYY-MM-DD"
  status: FoodStatus
  reaction: string // ghi chú phản ứng (khi status = reaction)
}

export interface BabyFood extends FoodInput {
  id: string
  createdAt: Date | null
  createdByName: string
}

export const FOOD_GROUPS = ['Rau củ', 'Trái cây', 'Tinh bột', 'Đạm', 'Sữa', 'Khác']

export const FOOD_STATUSES: { value: FoodStatus; label: string }[] = [
  { value: 'trying', label: 'Đang thử' },
  { value: 'ok', label: 'Ăn được' },
  { value: 'reaction', label: 'Có phản ứng' },
]

// Số ngày theo dõi khi thử món mới
export const TRIAL_DAYS = 3

// Từ khoá nhận ra thực phẩm dễ dị ứng (so sánh không dấu, không phân biệt hoa thường)
const ALLERGEN_WORDS = [
  'trung', 'dau phong', 'lac', 'tom', 'cua', 'ghe', 'so', 'hen', 'ngheu', 'muc', 'bach tuoc', 'oc',
  'ca hoi', 'ca thu', 'ca ngu', 'ca basa', 'ca loc', 'ca chep', 'ca bien',
  'sua', 'sua bo', 'pho mai', 'pho mat', 'sua chua', 'lua mi', 'bot mi', 'me', 'vung', 'dau nanh', 'dau hu', 'hat dieu', 'oc cho',
]

// Bỏ dấu, chữ thường, gọn khoảng trắng: so sánh tên thực phẩm
export const foodKey = (text: string) =>
  text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')

// Tên có từ khoá dễ dị ứng (khớp nguyên từ, vd "cà rốt" không bị nhầm thành "cá")
export function looksAllergen(name: string) {
  const k = ` ${foodKey(name)} `
  return ALLERGEN_WORDS.some((w) => k.includes(` ${w} `))
}

// Thẻ ăn dặm trên Time line: icon 🥣 hoặc tên có "ăn dặm" -> khung nhập có thêm phần chi tiết bữa ăn
export const isMealCard = (card: { icon: string; name: string }) => card.icon === '🥣' || foodKey(card.name).includes('an dam')

// Đang trong 3 ngày theo dõi món mới: day = ngày thứ mấy (1..3); quá 3 ngày mà vẫn "đang thử" thì due = true (cần cập nhật kết quả)
export function trialInfo(food: Pick<BabyFood, 'status' | 'firstTried'>, today = todayText()) {
  if (food.status !== 'trying' || !food.firstTried) return null
  const days = Math.round((dateOf(today).getTime() - dateOf(food.firstTried).getTime()) / 86400000)
  if (days < 0) return null
  const until = dateOf(food.firstTried)
  until.setDate(until.getDate() + TRIAL_DAYS - 1)
  return { day: days + 1, due: days + 1 > TRIAL_DAYS, until }
}

export const babyFoodsCol = () => familyCol('babyFoods')

const OPTS = { serverTimestamps: 'estimate' } as const

function toFood(id: string, d: DocumentData): BabyFood {
  return {
    id,
    childId: d.childId ?? '',
    name: d.name ?? '',
    group: d.group ?? 'Khác',
    allergen: !!d.allergen,
    firstTried: d.firstTried ?? null,
    status: d.status === 'ok' || d.status === 'reaction' ? d.status : 'trying',
    reaction: d.reaction ?? '',
    createdAt: d.createdAt ? (d.createdAt as Timestamp).toDate() : null,
    createdByName: d.createdByName ?? '',
  }
}

const STATUS_ORDER: Record<FoodStatus, number> = { trying: 0, reaction: 1, ok: 2 }

// Thực phẩm của CON ĐANG CHỌN: đang thử trước, rồi có phản ứng, rồi ăn được; cùng nhóm thì theo tên. null = đang tải.
export function useChildFoods(): BabyFood[] | null {
  const { actor, child } = useBaby()
  const all = useLiveQuery<BabyFood[]>(actor.uid ? familyKey('babyFoods') : null, (on) =>
    onSnapshot(query(babyFoodsCol()), (snap) => on(snap.docs.map((d) => toFood(d.id, d.data(OPTS))), snap.metadata.fromCache)),
  )
  if (!all) return null
  if (!child) return []
  return all
    .filter((f) => f.childId === child.id)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'vi'))
}

export async function createFood(input: FoodInput, by: Actor) {
  await commit(addDoc(babyFoodsCol(), { ...input, createdAt: serverTimestamp(), createdBy: by.uid, createdByName: by.name }))
}

export async function updateFood(id: string, input: FoodInput) {
  await commit(updateDoc(doc(babyFoodsCol(), id), { ...input }))
}

export async function deleteFood(id: string) {
  await commit(deleteDoc(doc(babyFoodsCol(), id)))
}

/**
 * Bữa ăn dặm vừa ghi ở Time line có món chưa có trong danh sách: thêm vào danh sách (đang thử, thử lần đầu = ngày của bữa ăn);
 * món đã có mà chưa ghi ngày thử lần đầu thì ghi luôn ngày này.
 */
export async function recordMealFoods(childId: string, names: string[], date: string, foods: BabyFood[], by: Actor) {
  const batch = writeBatch(requireDb())
  let writes = 0
  for (const name of names) {
    const known = foods.find((f) => foodKey(f.name) === foodKey(name))
    if (!known) {
      batch.set(doc(babyFoodsCol()), {
        childId,
        name,
        group: 'Khác',
        allergen: looksAllergen(name),
        firstTried: date,
        status: 'trying',
        reaction: '',
        createdAt: serverTimestamp(),
        createdBy: by.uid,
        createdByName: by.name,
      })
      writes++
    } else if (!known.firstTried) {
      batch.update(doc(babyFoodsCol(), known.id), { firstTried: date })
      writes++
    }
  }
  if (writes > 0) await commit(batch.commit())
}
