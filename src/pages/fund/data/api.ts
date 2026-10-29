import {
  doc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { familyCol } from '../../../lib/family'
import { formatPercent } from '../../../lib/format'
import { addMonths, monthlyRate } from './interest'
import type { Fund, FundInput, FundSettings } from './types'

// Cấu trúc dữ liệu trên Firestore:
//   families/{familyId}/funds/{fundId}          nhóm quỹ (chỉ thành viên gia đình xem / sửa được)
//   families/{familyId}/transactions/{txId}     lịch sử nạp / rút / lãi
//   users/{uid}/settings/fund           cài đặt hiển thị của app Quỹ (RIÊNG từng tài khoản)

export const fundsCol = () => familyCol('funds')
export const txCol = () => familyCol('transactions')
export const settingsDoc = (uid: string) => doc(requireDb(), 'users', uid, 'settings', 'fund')

export async function createFund(input: FundInput, initialBalance: number, by: Actor) {
  const batch = writeBatch(requireDb())
  const fundRef = doc(fundsCol())
  batch.set(fundRef, {
    ...input,
    balance: initialBalance,
    interestAnchor: input.interestRate > 0 ? Timestamp.now() : null,
    interestPeriods: 0,
    createdAt: serverTimestamp(),
    createdBy: by.uid,
  })
  if (initialBalance > 0) {
    batch.set(doc(txCol()), {
      fundId: fundRef.id,
      type: 'deposit',
      amount: initialBalance,
      note: 'Số dư ban đầu',
      date: Timestamp.now(),
      createdAt: serverTimestamp(),
      createdBy: by.uid,
      createdByName: by.name,
    })
  }
  await commit(batch.commit())
}

export async function updateFund(fund: Fund, input: FundInput) {
  const data: Record<string, unknown> = { ...input }
  if (input.interestRate <= 0) {
    data.interestAnchor = null
    data.interestPeriods = 0
  } else if (!fund.interestRate) {
    // Vừa bật lãi: bắt đầu tính từ hôm nay
    data.interestAnchor = Timestamp.now()
    data.interestPeriods = 0
  }
  await commit(updateDoc(doc(fundsCol(), fund.id), data))
}

// Xoá quỹ và toàn bộ lịch sử giao dịch của quỹ đó
export async function deleteFund(fundId: string) {
  const txs = await getDocs(query(txCol(), where('fundId', '==', fundId)))
  const refs = [...txs.docs.map((d) => d.ref), doc(fundsCol(), fundId)]
  // Mỗi batch tối đa 500 thao tác
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(requireDb())
    refs.slice(i, i + 450).forEach((r) => batch.delete(r))
    await commit(batch.commit())
  }
}

export async function addTransaction(
  fundId: string,
  type: 'deposit' | 'withdraw',
  amount: number,
  date: Date,
  note: string,
  by: Actor,
) {
  const batch = writeBatch(requireDb())
  batch.set(doc(txCol()), {
    fundId,
    type,
    amount,
    note,
    date: Timestamp.fromDate(date),
    createdAt: serverTimestamp(),
    createdBy: by.uid,
    createdByName: by.name,
  })
  batch.update(doc(fundsCol(), fundId), { balance: increment(type === 'deposit' ? amount : -amount) })
  await commit(batch.commit())
}

export async function saveSettings(uid: string, settings: Partial<FundSettings>) {
  await commit(setDoc(settingsDoc(uid), settings, { merge: true }))
}

// Cộng lãi kép cho các tháng đã đến hạn. Chạy trong transaction để nhiều người / thiết bị
// mở app cùng lúc cũng không cộng lãi 2 lần.
export async function applyDueInterest(fundId: string) {
  const fundRef = doc(fundsCol(), fundId)
  await runTransaction(requireDb(), async (tx) => {
    const snap = await tx.get(fundRef)
    const data = snap.data()
    if (!data || !data.interestRate || !data.interestAnchor) return

    const anchor = (data.interestAnchor as Timestamp).toDate()
    const rate = monthlyRate(data.interestRate)
    const now = new Date()
    let balance: number = data.balance
    let periods: number = data.interestPeriods ?? 0
    let applied = 0

    // Giới hạn 120 tháng mỗi lần để tránh vòng lặp quá dài
    for (let due = addMonths(anchor, periods + 1); due <= now && applied < 120; due = addMonths(anchor, periods + 1)) {
      const interest = Math.round(balance * rate)
      if (interest > 0) {
        tx.set(doc(txCol()), {
          fundId,
          type: 'interest',
          amount: interest,
          note: `Lãi tháng (${formatPercent(data.interestRate)}/năm)`,
          date: Timestamp.fromDate(due),
          createdAt: serverTimestamp(),
        })
        balance += interest
      }
      periods++
      applied++
    }

    if (applied > 0) tx.update(fundRef, { balance, interestPeriods: periods })
  })
}
