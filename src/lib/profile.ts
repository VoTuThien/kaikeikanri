import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useSyncExternalStore } from 'react'
import { commit, requireDb } from './firestore'

// Thông tin cá nhân của từng tài khoản: profiles/{uid}
// (tên, nickname, ngày sinh, giới tính, nghề nghiệp, ảnh avatar). Người đã đăng nhập đọc được hồ sơ theo đúng uid
// (để hiện avatar thật của thành viên trong gia đình), không liệt kê được; mỗi người chỉ sửa được hồ sơ của mình (firestore.rules).
// Ảnh không dùng Firebase Storage: cắt vuông + thu nhỏ 256px JPEG trên máy (fileToSquareDataUrl) rồi lưu thẳng vào `photo` (data URL),
// giống ảnh của con ở app Chăm con.

export type PersonGender = 'male' | 'female' | ''
export const PERSON_GENDERS: { value: Exclude<PersonGender, ''>; label: string }[] = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
]

export interface ProfileInput {
  name: string
  nickname: string // "" = không có
  birthDate: string // "YYYY-MM-DD", "" = chưa nhập
  gender: PersonGender // "" = chưa chọn
  job: string // nghề nghiệp, "" = chưa nhập
  photo: string | null // data URL JPEG hoặc null (avatar 2 chữ cái)
}

export const profileDoc = (uid: string) => doc(requireDb(), 'profiles', uid)

export async function saveProfile(uid: string, input: ProfileInput) {
  await commit(setDoc(profileDoc(uid), { ...input, updatedAt: serverTimestamp() }, { merge: true }))
}

// Tuổi theo ngày sinh: "32 tuổi"
export function personAge(birthDate: string, now = new Date()) {
  const [y, m, d] = birthDate.split('-').map(Number)
  if (!y) return ''
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age >= 0 ? `${age} tuổi` : ''
}

// ---- Đọc hồ sơ (realtime, dùng chung giữa mọi chỗ hiện avatar của cùng 1 người) ----
// undefined = đang tải, null = chưa có hồ sơ
type Entry = { value: ProfileInput | null | undefined; users: number; unsub?: () => void; listeners: Set<() => void> }
const store = new Map<string, Entry>()

function entryOf(uid: string) {
  let e = store.get(uid)
  if (!e) {
    e = { value: undefined, users: 0, listeners: new Set() }
    store.set(uid, e)
  }
  return e
}

function retain(uid: string) {
  const e = entryOf(uid)
  if (e.users++ === 0) {
    e.unsub = onSnapshot(
      profileDoc(uid),
      (snap) => {
        const d = snap.data()
        e.value = d
          ? {
              name: String(d.name ?? ''),
              nickname: String(d.nickname ?? ''),
              birthDate: String(d.birthDate ?? ''),
              gender: (d.gender ?? '') as PersonGender,
              job: String(d.job ?? ''),
              photo: (d.photo as string | null) ?? null,
            }
          : null
        e.listeners.forEach((l) => l())
      },
      (err) => {
        console.error('Đọc hồ sơ thất bại', err)
        e.value = null
        e.listeners.forEach((l) => l())
      },
    )
  }
}

// Bỏ theo dõi sau 1 lúc (không hiện avatar của người đó nữa); giữ lại dữ liệu đã có để lần sau hiện ngay
function release(uid: string) {
  const e = entryOf(uid)
  window.setTimeout(() => {
    if (--e.users === 0) {
      e.unsub?.()
      e.unsub = undefined
    }
  }, 30000)
}

export function useProfile(uid: string | undefined): ProfileInput | null | undefined {
  useEffect(() => {
    if (!uid) return
    retain(uid)
    return () => release(uid)
  }, [uid])
  return useSyncExternalStore(
    (l) => {
      if (!uid) return () => {}
      const e = entryOf(uid)
      e.listeners.add(l)
      return () => e.listeners.delete(l)
    },
    () => (uid ? entryOf(uid).value : null),
  )
}
