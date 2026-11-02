import { useEffect, useState } from 'react'
import { doc, increment, onSnapshot, runTransaction, serverTimestamp, setDoc, Timestamp, type DocumentData } from 'firebase/firestore'
import { useAuth } from '../../../contexts/AuthContext'
import { useFamily } from '../../../contexts/FamilyContext'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { familyCol } from '../../../lib/family'
import { familyKey, useLiveQuery } from '../../../lib/liveQuery'
import { fundsCol, txCol } from './api'
import { monthId, monthLabel, salariesCol, shiftMonth } from './orders'

// Lương của từng thành viên (thuộc gia đình đang chọn):
//   families/{familyId}/salaryInfo/{uid}                   thông tin lương: ngày nhận lương (1-31) + quỹ nhận lương
//                                                          (cả gia đình xem được, mỗi người chỉ sửa của mình)
//   families/{familyId}/fundRuns/{YYYY-MM}/salaries/{uid}  lương thực lãnh của tháng (amount, fundId, txId = giao dịch nạp vào quỹ)
// Đến ngày nhận lương mà chưa nhập lương thực lãnh của tháng đó thì chuông ở màn hình chính có thông báo nhắc,
// thông báo còn đó cho tới khi nhập xong. Nhập lương thực lãnh thì tự nạp số tiền đó vào quỹ nhận lương.

export const salaryInfoCol = () => familyCol('salaryInfo')

export interface SalaryInfo {
  uid: string
  name: string
  payday: number | null // ngày nhận lương trong tháng; null = chưa thiết đặt
  fundId: string | null // quỹ nhận lương; null = không chuyển vào quỹ nào
  createdAt: Date | null
}

const toDate = (v: unknown) => (v ? (v as Timestamp).toDate() : null)

export function toSalaryInfo(uid: string, d: DocumentData): SalaryInfo {
  return { uid, name: d.name ?? '', payday: d.payday ?? null, fundId: d.fundId ?? null, createdAt: toDate(d.createdAt) }
}

// Thông tin lương của mọi thành viên trong gia đình đang chọn, realtime. null = đang tải.
// Thành viên chưa có / để trống ngày nhận lương = KHÔNG CÓ LƯƠNG: không nhắc, không cần nhập lương thực lãnh.
export function useSalaryInfos(): SalaryInfo[] | null {
  return useLiveQuery<SalaryInfo[]>(familyKey('salaryInfo'), (on) =>
    onSnapshot(salaryInfoCol(), (snap) =>
      on(
        snap.docs.map((d) => toSalaryInfo(d.id, d.data({ serverTimestamps: 'estimate' }))),
        snap.metadata.fromCache,
      ),
    ),
  )
}

// Sửa thông tin lương của mình (ngày nhận lương / quỹ nhận lương), lưu ngay khi đổi
export async function saveSalaryInfo(by: Actor, data: Partial<Pick<SalaryInfo, 'payday' | 'fundId'>>, isNew: boolean) {
  await commit(
    setDoc(doc(salaryInfoCol(), by.uid), { ...data, name: by.name, ...(isNew ? { createdAt: serverTimestamp() } : {}) }, { merge: true }),
  )
}

// Ngày nhận lương của tháng (ngày 31 mà tháng chỉ có 30 ngày thì lấy ngày cuối tháng)
export function paydayOf(month: string, payday: number) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return new Date(y, m - 1, Math.min(payday, last))
}

/**
 * Lưu lương thực lãnh của tháng và nạp vào quỹ nhận lương (cùng 1 Firestore transaction).
 * Sửa lại số tiền thì sửa luôn giao dịch nạp cũ (số dư quỹ đổi theo phần chênh lệch);
 * đổi quỹ nhận lương thì rút khỏi quỹ cũ, nạp vào quỹ mới.
 */
export async function saveSalary(month: string, by: Actor, amount: number, fundId: string | null) {
  const salaryRef = doc(salariesCol(month), by.uid)
  await runTransaction(requireDb(), async (tx) => {
    const old = (await tx.get(salaryRef)).data()
    // Quỹ có thể đã bị xoá: chỉ đụng tới quỹ còn tồn tại
    const exists = async (id: string | null | undefined) => !!id && (await tx.get(doc(fundsCol(), id))).exists()
    const target = (await exists(fundId)) ? fundId : null
    const oldFund = old?.txId && (await exists(old.fundId)) ? (old.fundId as string) : null

    let txId: string | null = old?.txId ?? null
    const note = `Lương thực lãnh ${monthLabel(month).toLowerCase()}`
    if (txId && oldFund && oldFund === target) {
      // Cùng quỹ: sửa số tiền của giao dịch cũ
      tx.update(doc(txCol(), txId), { amount, note })
      tx.update(doc(fundsCol(), target), { balance: increment(amount - (old!.amount ?? 0)) })
    } else {
      // Khác quỹ (hoặc lần đầu): bỏ giao dịch cũ, tạo giao dịch nạp mới
      if (txId) {
        tx.delete(doc(txCol(), txId))
        if (oldFund) tx.update(doc(fundsCol(), oldFund), { balance: increment(-(old!.amount ?? 0)) })
        txId = null
      }
      if (target) {
        const ref = doc(txCol())
        tx.set(ref, {
          fundId: target,
          type: 'deposit',
          amount,
          note,
          date: Timestamp.now(),
          createdAt: serverTimestamp(),
          createdBy: by.uid,
          createdByName: by.name,
          runId: month,
        })
        tx.update(doc(fundsCol(), target), { balance: increment(amount) })
        txId = ref.id
      }
    }
    tx.set(salaryRef, { name: by.name, amount, fundId: target, txId, updatedAt: serverTimestamp() })
  })
}

// Các tháng đã tới ngày nhận lương mà chưa nhập lương thực lãnh (xét tối đa 3 tháng gần nhất,
// không xét các tháng trước khi thiết đặt ngày nhận lương). Cũ nhất đứng đầu.
export const REMINDER_MONTHS = 3
export function pendingMonths(info: SalaryInfo | null, entered: Record<string, boolean>, now = new Date()) {
  if (!info?.payday) return []
  const current = monthId(now)
  const since = info.createdAt ? monthId(info.createdAt) : current
  const months: string[] = []
  for (let i = REMINDER_MONTHS - 1; i >= 0; i--) {
    const m = shiftMonth(current, -i)
    if (m < since || entered[m]) continue
    if (paydayOf(m, info.payday) <= now) months.push(m)
  }
  return months
}

/**
 * Nhắc nhập lương thực lãnh của người đang đăng nhập (gia đình đang chọn), cập nhật realtime.
 * Dùng cho chuông ở màn hình chính và trang Thông báo. `pending` = các tháng cần nhập, cũ nhất trước.
 */
export function useSalaryReminders(): { info: SalaryInfo | null; pending: string[]; loading: boolean } {
  const { user } = useAuth()
  const { current } = useFamily()
  const uid = user?.uid
  const familyId = current?.familyId
  const [info, setInfo] = useState<SalaryInfo | null | undefined>(undefined)
  const [entered, setEntered] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setInfo(undefined)
    setEntered({})
    if (!uid || !familyId) return
    const now = monthId(new Date())
    const months = Array.from({ length: REMINDER_MONTHS }, (_, i) => shiftMonth(now, -i))
    const unsubs = [
      onSnapshot(doc(salaryInfoCol(), uid), (snap) => setInfo(snap.exists() ? toSalaryInfo(uid, snap.data({ serverTimestamps: 'estimate' })) : null)),
      ...months.map((m) => onSnapshot(doc(salariesCol(m), uid), (snap) => setEntered((prev) => ({ ...prev, [m]: snap.exists() })))),
    ]
    return () => unsubs.forEach((u) => u())
  }, [uid, familyId])

  // Chờ đủ dữ liệu mới tính, để chuông không hiện nhắc nhầm trong lúc tải
  const loading = info === undefined || Object.keys(entered).length < REMINDER_MONTHS
  return { info: info ?? null, pending: loading ? [] : pendingMonths(info, entered), loading }
}
