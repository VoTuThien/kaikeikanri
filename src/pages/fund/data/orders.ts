import { collection, doc, getDocs, runTransaction, serverTimestamp, setDoc, Timestamp, writeBatch, type WriteBatch } from 'firebase/firestore'
import { commit, requireDb, type Actor } from '../../../lib/firestore'
import { familyCol } from '../../../lib/family'
import { formatMoney } from '../../../lib/format'
import { fundsCol, txCol } from './api'
import type { Fund, FundOrder, FundOrderInput, FundSnapshot } from './types'

// Lệnh chuyển và màn hình Thực thi (thuộc gia đình đang chọn, chỉ thành viên xem / sửa được):
//   families/{familyId}/fundOrders/{orderId}              lệnh chuyển soạn sẵn
//   families/{familyId}/fundRuns/{YYYY-MM}                đợt thực thi của tháng (đã tổng kết chưa, lệnh nào đã chạy)
//   families/{familyId}/fundRuns/{YYYY-MM}/salaries/{uid} lương thực lãnh của từng thành viên (mỗi người chỉ sửa của mình)

export const ordersCol = () => familyCol('fundOrders')
export const runsCol = () => familyCol('fundRuns')
export const runDoc = (month: string) => doc(runsCol(), month)
export const salariesCol = (month: string) => collection(runDoc(month), 'salaries')

const pad = (n: number) => String(n).padStart(2, '0')
// Date -> "YYYY-MM" (id của đợt)
export const monthId = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
// "YYYY-MM" -> "Tháng 11/2026"
export const monthLabel = (id: string) => {
  const [y, m] = id.split('-')
  return `Tháng ${Number(m)}/${y}`
}
// Lùi / tiến n tháng
export const shiftMonth = (id: string, n: number) => {
  const [y, m] = id.split('-').map(Number)
  return monthId(new Date(y, m - 1 + n, 1))
}

// ---- Lệnh chuyển ----

// Số thứ tự luôn liên tục 1..n, không trùng: mỗi lần thêm / sửa số thứ tự / xoá / kéo thả thì đánh số lại
// MỌI lệnh theo danh sách mới (ghi cùng 1 batch). Vd 7 lệnh, đổi lệnh 4 thành lệnh 2 thì lệnh 2, 3 cũ thành 3, 4.

// Ghi số thứ tự cho các lệnh `ids`, số = vị trí trong danh sách thứ tự mới `order` (mặc định chính `ids`; đầu danh sách = số 1)
function renumber(batch: WriteBatch, ids: string[], order: string[] = ids) {
  for (const id of ids) batch.update(doc(ordersCol(), id), { position: order.indexOf(id) + 1 })
}

// Đưa phần tử vào vị trí position (1-based) trong danh sách id
export function placeAt(ids: string[], id: string, position: number) {
  const rest = ids.filter((x) => x !== id)
  const at = Math.max(0, Math.min(rest.length, position - 1))
  return [...rest.slice(0, at), id, ...rest.slice(at)]
}

const clean = (input: FundOrderInput) => ({ ...input, amount: input.allBalance ? 0 : input.amount })

// ids: id các lệnh hiện có theo thứ tự hiện tại
export async function createOrder(input: FundOrderInput, by: Actor, ids: string[], position: number) {
  const batch = writeBatch(requireDb())
  const ref = doc(ordersCol())
  const next = placeAt(ids, ref.id, position)
  batch.set(ref, { ...clean(input), position: next.indexOf(ref.id) + 1, createdAt: serverTimestamp(), createdBy: by.uid })
  // Đánh số lại các lệnh còn lại theo vị trí mới (lệnh vừa tạo đã có số ở trên)
  renumber(
    batch,
    next.filter((x) => x !== ref.id),
    next,
  )
  await commit(batch.commit())
}

export async function updateOrder(id: string, input: FundOrderInput, ids: string[], position: number) {
  const batch = writeBatch(requireDb())
  batch.update(doc(ordersCol(), id), clean(input))
  renumber(batch, placeAt(ids, id, position))
  await commit(batch.commit())
}

// Kéo thả ở danh sách: lưu thứ tự mới
export async function reorderOrders(ids: string[]) {
  const batch = writeBatch(requireDb())
  renumber(batch, ids)
  await commit(batch.commit())
}

export async function deleteOrder(id: string, ids: string[]) {
  const batch = writeBatch(requireDb())
  batch.delete(doc(ordersCol(), id))
  renumber(batch, ids.filter((x) => x !== id))
  await commit(batch.commit())
}

// ---- Đợt thực thi ----

// Bước 1 (nhập lương thực lãnh, tự nạp vào quỹ nhận lương) ở data/salary.ts: saveSalary

// Bước 2: xác nhận đã tổng kết (by = null: huỷ tổng kết)
// Tổng kết thì lưu lại số dư của mọi quỹ tại thời điểm đó (`balances`, `total`) cho màn hình Thống kê;
// huỷ tổng kết thì xoá số liệu này.
export async function setSummarized(month: string, by: Actor | null) {
  if (!by) {
    await commit(
      setDoc(runDoc(month), { summarizedBy: null, summarizedByName: null, summarizedAt: null, balances: null, total: null }, { merge: true }),
    )
    return
  }
  // Đọc số dư mới nhất trên server (không dùng số trên màn hình, có thể vừa có người nạp / rút)
  const snap = await getDocs(fundsCol())
  const balances: Record<string, FundSnapshot> = {}
  let total = 0
  for (const d of snap.docs) {
    const v = d.data()
    balances[d.id] = { name: v.name ?? '', icon: v.icon ?? '💰', balance: v.balance ?? 0, transferred: !!v.transferred }
    // Giống màn hình app Quỹ: quỹ đã chuyển đi không tính vào tổng
    if (!v.transferred) total += v.balance ?? 0
  }
  await commit(
    setDoc(
      runDoc(month),
      { summarizedBy: by.uid, summarizedByName: by.name, summarizedAt: serverTimestamp(), balances, total },
      { merge: true },
    ),
  )
}

/**
 * Bước 3: chạy các lệnh đã chọn trong đợt. Chạy trong 1 Firestore transaction:
 * - Lệnh đã chạy trong đợt này (kể cả do người khác vừa chạy) thì báo lỗi, không chạy lại
 * - Tính số dư lần lượt theo thứ tự lệnh; quỹ nào không đủ tiền thì báo lỗi, không lệnh nào được chạy
 * - Ghi giao dịch (nạp / rút / chuyển đi + nhận về) và đánh dấu lệnh đã chạy, tất cả cùng lúc
 */
export async function executeOrders(month: string, orders: FundOrder[], funds: Fund[], by: Actor) {
  const nameOf = (id: string | null) => funds.find((f) => f.id === id)?.name ?? 'Quỹ đã xoá'
  await runTransaction(requireDb(), async (tx) => {
    const runSnap = await tx.get(runDoc(month))
    const executed = (runSnap.data()?.executed ?? {}) as Record<string, unknown>
    const done = orders.filter((o) => executed[o.id])
    if (done.length) throw new Error(`Lệnh đã được chạy trong đợt này: ${done.map((o) => describeOrder(o, nameOf)).join(', ')}.`)

    // Đọc số dư mới nhất của các quỹ liên quan
    const ids = [...new Set(orders.flatMap((o) => [o.fromFundId, o.toFundId]).filter((id): id is string => !!id))]
    const balance = new Map<string, number>()
    for (const id of ids) {
      const snap = await tx.get(doc(fundsCol(), id))
      if (!snap.exists()) throw new Error(`Quỹ không còn tồn tại, hãy sửa lại lệnh có quỹ "${nameOf(id)}".`)
      balance.set(id, snap.data().balance ?? 0)
    }

    const date = Timestamp.now()
    const base = { date, createdAt: serverTimestamp(), createdBy: by.uid, createdByName: by.name, runId: month }
    const label = `Lệnh chuyển ${monthLabel(month).toLowerCase()}`
    const writes: (() => void)[] = []
    // Chạy TUẦN TỰ theo số thứ tự: lệnh sau thấy số dư đã đổi bởi lệnh trước
    for (const o of [...orders].sort((a, b) => a.position - b.position)) {
      const note = o.note ? `${o.note} · ${label}` : label
      // "Toàn bộ số dư": lấy số dư của quỹ nguồn ngay lúc tới lượt lệnh này
      const amount = o.allBalance && o.fromFundId ? balance.get(o.fromFundId)! : o.amount
      if (o.fromFundId) {
        const left = balance.get(o.fromFundId)! - amount
        if (left < 0) {
          throw new Error(`"${nameOf(o.fromFundId)}" không đủ tiền cho lệnh số ${o.position} "${describeOrder(o, nameOf)}" (còn ${formatMoney(balance.get(o.fromFundId)!)}).`)
        }
        balance.set(o.fromFundId, left)
      }
      if (o.toFundId) balance.set(o.toFundId, balance.get(o.toFundId)! + amount)
      // Quỹ nguồn đang 0 đồng (lệnh toàn bộ số dư): không có gì để chuyển, chỉ đánh dấu đã chạy
      if (amount <= 0) continue

      writes.push(() => {
        const common = { ...base, amount, orderId: o.id }
        if (o.type === 'transfer') {
          const outRef = doc(txCol())
          const inRef = doc(txCol())
          tx.set(outRef, { ...common, pairId: inRef.id, fundId: o.fromFundId, peerFundId: o.toFundId, type: 'transfer_out', note })
          tx.set(inRef, { ...common, pairId: outRef.id, fundId: o.toFundId, peerFundId: o.fromFundId, type: 'transfer_in', note })
        } else if (o.type === 'withdraw') {
          tx.set(doc(txCol()), { ...common, fundId: o.fromFundId, type: 'withdraw', note })
        } else {
          tx.set(doc(txCol()), { ...common, fundId: o.toFundId, type: 'deposit', note })
        }
      })
    }

    // Kiểm tra xong hết mới ghi
    writes.forEach((w) => w())
    for (const [id, b] of balance) tx.update(doc(fundsCol(), id), { balance: b })
    const marks = Object.fromEntries(orders.map((o) => [o.id, date]))
    tx.set(runDoc(month), { executed: marks }, { merge: true })
  })
}

// Mô tả ngắn 1 lệnh: "Quỹ A → Quỹ B", "Rút từ Quỹ A", "Nạp vào Quỹ B"
export function describeOrder(o: Pick<FundOrder, 'type' | 'fromFundId' | 'toFundId'>, nameOf: (id: string | null) => string) {
  if (o.type === 'transfer') return `${nameOf(o.fromFundId)} → ${nameOf(o.toFundId)}`
  if (o.type === 'withdraw') return `Rút từ ${nameOf(o.fromFundId)}`
  return `Nạp vào ${nameOf(o.toFundId)}`
}
