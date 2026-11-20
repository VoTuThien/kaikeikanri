// "Đã xem tới bản nào" của màn hình Có gì mới: lưu THEO TÀI KHOẢN ở users/{uid}/settings/game (`seenVersion`),
// không theo vườn (người chơi ở 2 gia đình chỉ thấy 1 lần) và không theo máy (đổi máy không bị hiện lại).
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { requireDb } from '../../../lib/firestore'
import { LATEST_VERSION } from './changelog'

export const gameSettingsDoc = (uid: string) => doc(requireDb(), 'users', uid, 'settings', 'game')

// null = chưa có bản ghi (chưa từng xem lần nào)
export async function loadSeenVersion(uid: string): Promise<string | null> {
  const snap = await getDoc(gameSettingsDoc(uid))
  return snap.exists() ? String(snap.data().seenVersion ?? '') : null
}
export function saveSeenVersion(uid: string, version = LATEST_VERSION) {
  return setDoc(gameSettingsDoc(uid), { seenVersion: version }, { merge: true })
}
// Người chơi mới (vừa tạo vườn đầu tiên): coi như đã xem bản mới nhất, không hiện danh sách cập nhật cũ
export async function markSeenIfNew(uid: string) {
  const snap = await getDoc(gameSettingsDoc(uid))
  if (!snap.exists()) await saveSeenVersion(uid)
}
