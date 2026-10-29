import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { commit, requireDb, type Actor } from '../../../lib/firestore'

// Cấu trúc dữ liệu gia đình trên Firestore:
//   families/{familyId}                       gia đình (tên, mã, chủ gia đình)
//   families/{familyId}/members/{uid}         thành viên (chỉ chủ gia đình thêm được)
//   families/{familyId}/requests/{uid}        yêu cầu xin tham gia đang chờ duyệt
//   familyCodes/{code}                        tra mã 6 ký tự -> familyId (ai đăng nhập cũng tra được đúng 1 mã)
//   users/{uid}/families/{familyId}           các gia đình mình là thành viên (để hiện ô chọn gia đình)
//   users/{uid}/requests/{familyId}           các yêu cầu mình đã gửi, đang chờ duyệt
//   users/{uid}/meta/ownedFamily              gia đình mình đã tạo (mỗi người chỉ tạo được 1)

export const familiesCol = () => collection(requireDb(), 'families')
export const membersCol = (familyId: string) => collection(requireDb(), 'families', familyId, 'members')
export const requestsCol = (familyId: string) => collection(requireDb(), 'families', familyId, 'requests')
export const myFamiliesCol = (uid: string) => collection(requireDb(), 'users', uid, 'families')
export const mySentRequestsCol = (uid: string) => collection(requireDb(), 'users', uid, 'requests')
const codeDoc = (code: string) => doc(requireDb(), 'familyCodes', code)
const ownedDoc = (uid: string) => doc(requireDb(), 'users', uid, 'meta', 'ownedFamily')

// Mã gia đình: 6 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6
function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

// Chuẩn hoá mã người dùng nhập: viết hoa, bỏ khoảng trắng
export const normalizeCode = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)

/**
 * Tạo gia đình mới, người tạo là chủ gia đình. Ghi cùng lúc (batch):
 * gia đình + thành viên chủ + mã tra cứu + danh sách gia đình của mình + đánh dấu "đã tạo 1 gia đình".
 * Security Rules chặn tạo gia đình thứ 2 và chặn mã bị trùng (khi đó thử mã khác).
 */
export async function createFamily(name: string, by: Actor & { email: string }) {
  if ((await getDoc(ownedDoc(by.uid))).exists()) throw new Error('already-owner')

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    if ((await getDoc(codeDoc(code))).exists()) continue // mã đã có người dùng, thử mã khác
    const familyRef = doc(familiesCol())
    const batch = writeBatch(requireDb())
    batch.set(familyRef, { name, code, ownerUid: by.uid, ownerName: by.name, createdAt: serverTimestamp() })
    batch.set(doc(membersCol(familyRef.id), by.uid), { uid: by.uid, name: by.name, email: by.email, role: 'owner', joinedAt: serverTimestamp() })
    batch.set(codeDoc(code), { familyId: familyRef.id, name })
    batch.set(doc(myFamiliesCol(by.uid), familyRef.id), { familyId: familyRef.id, name, code, role: 'owner', joinedAt: serverTimestamp() })
    batch.set(ownedDoc(by.uid), { familyId: familyRef.id })
    await batch.commit()
    return familyRef.id
  }
  throw new Error('code-collision')
}

// Tra mã gia đình -> { familyId, name }; không có thì null
export async function findFamilyByCode(code: string): Promise<{ familyId: string; name: string } | null> {
  const snap = await getDoc(codeDoc(code))
  return snap.exists() ? { familyId: snap.data().familyId, name: snap.data().name ?? '' } : null
}

// Gửi yêu cầu tham gia: ghi vào gia đình (để chủ gia đình duyệt) và vào danh sách "đã gửi" của mình
export async function sendJoinRequest(family: { familyId: string; name: string }, by: Actor & { email: string }) {
  const batch = writeBatch(requireDb())
  batch.set(doc(requestsCol(family.familyId), by.uid), { uid: by.uid, name: by.name, email: by.email, createdAt: serverTimestamp() })
  batch.set(doc(mySentRequestsCol(by.uid), family.familyId), { familyId: family.familyId, name: family.name, createdAt: serverTimestamp() })
  await commit(batch.commit())
}

// Huỷ yêu cầu mình đã gửi
export async function cancelJoinRequest(familyId: string, uid: string) {
  const batch = writeBatch(requireDb())
  batch.delete(doc(requestsCol(familyId), uid))
  batch.delete(doc(mySentRequestsCol(uid), familyId))
  await commit(batch.commit())
}

export interface JoinRequest {
  uid: string
  name: string
  email: string
  createdAt: Date | null
}

// Chủ gia đình duyệt: thêm thành viên + thêm gia đình vào danh sách của người đó + xoá yêu cầu
export async function approveJoinRequest(family: { familyId: string; name: string; code: string }, req: JoinRequest) {
  const batch = writeBatch(requireDb())
  batch.set(doc(membersCol(family.familyId), req.uid), { uid: req.uid, name: req.name, email: req.email, role: 'member', joinedAt: serverTimestamp() })
  batch.set(doc(myFamiliesCol(req.uid), family.familyId), {
    familyId: family.familyId,
    name: family.name,
    code: family.code,
    role: 'member',
    joinedAt: serverTimestamp(),
  })
  batch.delete(doc(requestsCol(family.familyId), req.uid))
  batch.delete(doc(mySentRequestsCol(req.uid), family.familyId))
  await commit(batch.commit())
}

// Chủ gia đình từ chối: xoá yêu cầu ở cả 2 nơi
export async function rejectJoinRequest(familyId: string, uid: string) {
  await cancelJoinRequest(familyId, uid)
}

export interface Member {
  uid: string
  name: string
  email: string
  role: 'owner' | 'member'
  joinedAt: Date | null
}

const presenceDoc = (familyId: string, uid: string) => doc(requireDb(), 'families', familyId, 'presence', uid)

// Chủ gia đình đổi tên: cập nhật gia đình, mã tra cứu và tên hiển thị trong danh sách gia đình của từng thành viên
export async function renameFamily(family: { familyId: string; code: string }, name: string, memberUids: string[]) {
  const batch = writeBatch(requireDb())
  batch.update(doc(familiesCol(), family.familyId), { name })
  batch.update(codeDoc(family.code), { name })
  for (const uid of memberUids) batch.update(doc(myFamiliesCol(uid), family.familyId), { name })
  await commit(batch.commit())
}

// Gỡ 1 người khỏi gia đình (chủ gia đình xoá thành viên, hoặc thành viên tự rời):
// bỏ khỏi danh sách thành viên, khỏi danh sách gia đình của họ, và xoá luôn trạng thái "đang ở đâu" của họ.
// Chủ gia đình không rời được gia đình mình tạo.
export async function removeMember(familyId: string, uid: string) {
  const batch = writeBatch(requireDb())
  batch.delete(doc(membersCol(familyId), uid))
  batch.delete(doc(myFamiliesCol(uid), familyId))
  batch.delete(presenceDoc(familyId, uid))
  await commit(batch.commit())
}
