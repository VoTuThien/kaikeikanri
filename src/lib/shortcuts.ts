import { useEffect, useState } from 'react'
import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { shortcutById } from '../shortcuts'
import { commit, requireDb } from './firestore'

// Phím tắt và 2 màn hình 2 bên của màn hình chính là dữ liệu RIÊNG từng tài khoản (không theo gia đình):
//   users/{uid}/settings/launcher   {
//     shortcuts: string[]   phím tắt (id trong src/shortcuts.ts, theo thứ tự thêm)
//     left: string | null   màn hình bên trái (vuốt sang phải ở màn hình chính để mở)
//     right: string | null  màn hình bên phải (vuốt sang trái để mở)
//   }
const launcherDoc = (uid: string) => doc(requireDb(), 'users', uid, 'settings', 'launcher')

export type Side = 'left' | 'right'

export interface LauncherData {
  ids: string[]
  left: string | null
  right: string | null
}

const EMPTY: LauncherData = { ids: [], left: null, right: null }
const CACHE_KEY = 'launcher-shortcuts'

// Bỏ id không còn trong danh sách màn hình (màn hình đã bị gỡ khỏi app)
const known = (ids: unknown): string[] => (Array.isArray(ids) ? ids.filter((id) => shortcutById.has(id)) : [])
const knownOne = (id: unknown) => (typeof id === 'string' && shortcutById.has(id) ? id : null)

// Skeleton và lần vẽ đầu cần biết dữ liệu trước khi Firestore tải xong, để trang không bị nhảy
export function getCachedLauncher(uid?: string): LauncherData {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    return raw && (!uid || raw.uid === uid) ? { ids: known(raw.ids), left: knownOne(raw.left), right: knownOne(raw.right) } : EMPTY
  } catch {
    return EMPTY
  }
}

export const getCachedShortcuts = () => getCachedLauncher().ids

export function useShortcuts(uid: string | undefined): LauncherData {
  const [data, setData] = useState<LauncherData>(() => (uid ? getCachedLauncher(uid) : EMPTY))

  useEffect(() => {
    if (!uid) return setData(EMPTY)
    setData(getCachedLauncher(uid))
    return onSnapshot(launcherDoc(uid), (snap) => {
      const d = snap.data()
      const next = { ids: known(d?.shortcuts), left: knownOne(d?.left), right: knownOne(d?.right) }
      setData(next)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, ...next }))
      } catch {
        // Không lưu được cache thì skeleton không có phím tắt
      }
    })
  }, [uid])

  return data
}

// Đường dẫn của màn hình 2 bên; chưa thiết đặt thì là trang có dấu "+" để chọn
export function sidePath(side: Side, id: string | null) {
  return (id && shortcutById.get(id)?.path) || `/side/${side}`
}

// Người dùng đang ở màn hình nào của màn hình chính (giữa / bên trái / bên phải), để thoát app rồi mở lại
// vẫn về đúng chỗ đó. Lưu trong máy (localStorage) theo từng tài khoản.
export type HomeScreen = 'home' | Side
const homeScreenKey = (uid: string) => `home-screen:${uid}`

export function loadHomeScreen(uid: string): HomeScreen {
  try {
    const v = localStorage.getItem(homeScreenKey(uid))
    return v === 'left' || v === 'right' ? v : 'home'
  } catch {
    return 'home'
  }
}

export function saveHomeScreen(uid: string, screen: HomeScreen) {
  try {
    localStorage.setItem(homeScreenKey(uid), screen)
  } catch {
    // Không lưu được: mở lại app thì về màn hình chính
  }
}

// Mở màn hình từ phím tắt: nút quay lại trên màn hình đó về thẳng màn hình chính (không về trang chính của app con).
// Nhớ đường dẫn đã mở trong sessionStorage (không theo lịch sử trình duyệt) để vào màn hình con rồi quay lại vẫn đúng.
// Màn hình chính xoá dấu này mỗi khi hiện ra, nên vào app con bằng icon app thì quay lại như bình thường.
const ENTRY_KEY = 'shortcut-entry'

export function markShortcutEntry(path: string) {
  try {
    sessionStorage.setItem(ENTRY_KEY, path)
  } catch {
    // Không lưu được: nút quay lại về trang chính của app con như bình thường
  }
}

export function clearShortcutEntry() {
  try {
    sessionStorage.removeItem(ENTRY_KEY)
  } catch {
    // bỏ qua
  }
}

export function isShortcutEntry(path: string) {
  try {
    return sessionStorage.getItem(ENTRY_KEY) === path
  } catch {
    return false
  }
}

export async function addShortcut(uid: string, id: string) {
  await commit(setDoc(launcherDoc(uid), { shortcuts: arrayUnion(id) }, { merge: true }))
}

export async function removeShortcut(uid: string, id: string) {
  await commit(setDoc(launcherDoc(uid), { shortcuts: arrayRemove(id) }, { merge: true }))
}

// Thiết đặt (id) hoặc bỏ thiết đặt (null) màn hình bên trái / phải
export async function setSideScreen(uid: string, side: Side, id: string | null) {
  await commit(setDoc(launcherDoc(uid), { [side]: id }, { merge: true }))
}
