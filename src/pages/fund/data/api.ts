import {
  doc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { familyCol } from '../../../lib/family'
import { formatMoney, formatPercent } from '../../../lib/format'
import { addMonths, monthlyRate } from './interest'
import { monthId, monthLabel, placeAt, runDoc } from './orders'
import type { Fund, FundInput, FundSettings, FundTransaction } from './types'

// Cấu trúc dữ liệu trên Firestore:
//   families/{familyId}/funds/{fundId}          nhóm quỹ (chỉ thành viên gia đình xem / sửa được)
//   families/{familyId}/transactions/{txId}     lịch sử nạp / rút / lãi
//   users/{uid}/settings/fund           cài đặt hiển thị của app Quỹ (RIÊNG từng tài khoản)

export const fundsCol = () => familyCol('funds')
export const txCol = () => familyCol('transactions')
export const settingsDoc = (uid: string) => doc(requireDb(), 'users', uid, 'settings', 'fund')

// Số thứ tự nhóm quỹ luôn liên tục 1..n, không trùng: thêm / đổi số / xoá / kéo thả thì đánh số lại MỌI quỹ (cùng 1 batch).
// ids = id các quỹ theo thứ tự hiện tại; position = số thứ tự muốn đặt (1-based)
function renumberFunds(batch: WriteBatch, order: string[], skip?: string) {
  order.forEach((id, i) => id !== skip && batch.update(doc(fundsCol(), id), { position: i + 1 }))
}

export async function reorderFunds(ids: string[]) {
  const batch = writeBatch(requireDb())
  renumberFunds(batch, ids)
  await commit(batch.commit())
}

export async function createFund(input: FundInput, initialBalance: number, by: Actor, ids: string[], position: number) {
  const batch = writeBatch(requireDb())
  const fundRef = doc(fundsCol())
  const order = placeAt(ids, fundRef.id, position)
  renumberFunds(batch, order, fundRef.id)
  batch.set(fundRef, {
    ...input,
    position: order.indexOf(fundRef.id) + 1,
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

export async function updateFund(fund: Fund, input: FundInput, ids: string[], position: number) {
  const data: Record<string, unknown> = { ...input }
  if (input.interestRate <= 0) {
    data.interestAnchor = null
    data.interestPeriods = 0
  } else if (!fund.interestRate) {
    // Vừa bật lãi: bắt đầu tính từ hôm nay
    data.interestAnchor = Timestamp.now()
    data.interestPeriods = 0
  }
  const batch = writeBatch(requireDb())
  batch.update(doc(fundsCol(), fund.id), data)
  renumberFunds(batch, placeAt(ids, fund.id, position))
  await commit(batch.commit())
}

// Xoá quỹ và toàn bộ lịch sử giao dịch của quỹ đó; các quỹ còn lại được đánh số lại
export async function deleteFund(fundId: string, ids: string[]) {
  const txs = await getDocs(query(txCol(), where('fundId', '==', fundId)))
  const refs = [...txs.docs.map((d) => d.ref), doc(fundsCol(), fundId)]
  // Mỗi batch tối đa 500 thao tác
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(requireDb())
    refs.slice(i, i + 450).forEach((r) => batch.delete(r))
    await commit(batch.commit())
  }
  await reorderFunds(ids.filter((id) => id !== fundId))
}

export async function addTransaction(
  fundId: string,
  type: 'deposit' | 'withdraw',
  amount: number,
  date: Date,
  note: string,
  by: Actor,
  // Rút theo hoá đơn (màn hình Đọc hoá đơn): loại hoá đơn + các sản phẩm đọc được { name, qty, amount }
  receipt?: { kind: string; items: { name: string; qty: number; amount: number }[] },
) {
  const batch = writeBatch(requireDb())
  batch.set(doc(txCol()), {
    fundId,
    type,
    amount,
    note,
    ...(receipt ? { receipt: receipt.kind, items: receipt.items } : {}),
    date: Timestamp.fromDate(date),
    createdAt: serverTimestamp(),
    createdBy: by.uid,
    createdByName: by.name,
  })
  batch.update(doc(fundsCol(), fundId), { balance: increment(type === 'deposit' ? amount : -amount) })
  await commit(batch.commit())
}

// Chuyển tiền từ quỹ này sang quỹ khác: ghi 2 giao dịch và cập nhật 2 số dư trong cùng 1 batch
export async function transferFunds(
  from: Fund,
  to: Fund,
  amount: number,
  date: Date,
  note: string,
  by: Actor,
) {
  const batch = writeBatch(requireDb())
  const base = {
    amount,
    date: Timestamp.fromDate(date),
    createdAt: serverTimestamp(),
    createdBy: by.uid,
    createdByName: by.name,
  }
  // 2 giao dịch của 1 lần chuyển trỏ tới nhau (pairId) để xoá thì xoá cả cặp
  const outRef = doc(txCol())
  const inRef = doc(txCol())
  batch.set(outRef, {
    ...base,
    pairId: inRef.id,
    fundId: from.id,
    peerFundId: to.id,
    type: 'transfer_out',
    note: note ? `${note} · sang ${to.name}` : `Chuyển sang ${to.name}`,
  })
  batch.set(inRef, {
    ...base,
    pairId: outRef.id,
    fundId: to.id,
    peerFundId: from.id,
    type: 'transfer_in',
    note: note ? `${note} · từ ${from.name}` : `Nhận từ ${from.name}`,
  })
  batch.update(doc(fundsCol(), from.id), { balance: increment(-amount) })
  batch.update(doc(fundsCol(), to.id), { balance: increment(amount) })
  await commit(batch.commit())
}

/**
 * Xoá 1 giao dịch nạp / rút / chuyển bị nhập sai: KHÔNG xoá hẳn mà đánh dấu `deleted` (vẫn hiện ở Tra cứu, nền xám)
 * và hoàn lại số dư các quỹ như trước khi giao dịch. Giao dịch chuyển thì xoá cả cặp (chuyển đi + nhận về).
 * Chạy trong 1 Firestore transaction; hoàn lại làm số dư quỹ âm (tiền đã bị dùng tiếp) thì báo lỗi, không xoá.
 */
// Giao dịch đã bị TỔNG KẾT (tháng của giao dịch đã tổng kết, và giao dịch được ghi trước lúc tổng kết) thì không xoá được nữa
export function lockedBySummary(t: Pick<FundTransaction, 'date' | 'createdAt'>, summarizedAt: Date | null) {
  return !!summarizedAt && (t.createdAt ?? t.date) <= summarizedAt
}

export async function deleteTransaction(t: FundTransaction, by: Actor, nameOf: (id: string) => string) {
  if (t.type === 'interest') throw new Error('Không xoá được tiền lãi tự động.')
  // Giao dịch nạp lương thực lãnh: sửa ở bước 1 của màn hình Thực thi để không lệch với lương đã nhập
  if (t.type === 'deposit' && t.runId && !t.orderId) throw new Error('Đây là tiền lương thực lãnh, hãy sửa ở bước 1 của màn hình Thực thi.')

  const isTransfer = t.type === 'transfer_out' || t.type === 'transfer_in'
  let pairId = t.pairId
  if (isTransfer && !pairId) {
    // Dữ liệu cũ chưa có pairId: tìm giao dịch còn lại (cùng ngày giờ, cùng số tiền, 2 quỹ đảo nhau)
    const found = await getDocs(
      query(
        txCol(),
        where('fundId', '==', t.peerFundId),
        where('peerFundId', '==', t.fundId),
        where('type', '==', t.type === 'transfer_out' ? 'transfer_in' : 'transfer_out'),
        where('date', '==', Timestamp.fromDate(t.date)),
        where('amount', '==', t.amount),
      ),
    )
    pairId = found.docs[0]?.id ?? null
  }

  await runTransaction(requireDb(), async (tx) => {
    const refs = [doc(txCol(), t.id), ...(pairId ? [doc(txCol(), pairId)] : [])]
    const snaps = await Promise.all(refs.map((r) => tx.get(r)))
    if (snaps.some((s) => s.data()?.deleted)) throw new Error('Giao dịch này đã được xoá.')
    // Kiểm tra lại trên server: tháng của giao dịch đã tổng kết thì không cho xoá
    const run = (await tx.get(runDoc(monthId(t.date)))).data()
    const summarizedAt = run?.summarizedAt ? (run.summarizedAt as Timestamp).toDate() : null
    if (lockedBySummary(t, summarizedAt)) throw new Error(`Giao dịch đã được tổng kết trong ${monthLabel(monthId(t.date)).toLowerCase()} nên không xoá được.`)

    // Số tiền cần trả lại cho từng quỹ để về như trước giao dịch
    const delta = new Map<string, number>()
    const add = (id: string | null, v: number) => id && delta.set(id, (delta.get(id) ?? 0) + v)
    if (t.type === 'deposit') add(t.fundId, -t.amount)
    else if (t.type === 'withdraw') add(t.fundId, t.amount)
    else {
      const from = t.type === 'transfer_out' ? t.fundId : t.peerFundId
      const to = t.type === 'transfer_out' ? t.peerFundId : t.fundId
      add(from, t.amount)
      add(to, -t.amount)
    }

    const balances = new Map<string, number>()
    for (const [id, d] of delta) {
      const snap = await tx.get(doc(fundsCol(), id))
      if (!snap.exists()) continue // quỹ đã bị xoá thì bỏ qua
      const next = (snap.data().balance ?? 0) + d
      if (next < 0) throw new Error(`"${nameOf(id)}" không còn đủ tiền để hoàn lại giao dịch này (sẽ âm ${formatMoney(-next)}).`)
      balances.set(id, next)
    }

    const mark = { deleted: true, deletedAt: serverTimestamp(), deletedBy: by.uid, deletedByName: by.name }
    refs.forEach((r) => tx.update(r, mark))
    for (const [id, b] of balances) tx.update(doc(fundsCol(), id), { balance: b })
  })
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
