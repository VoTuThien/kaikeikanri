import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { limit, onSnapshot, orderBy, query, type DocumentData, type Timestamp } from 'firebase/firestore'
import { formatMoney } from '../../../lib/format'
import { familyKey, useLiveQuery } from '../../../lib/liveQuery'
import type { Actor } from '../../../lib/firestore'
import { applyDueInterest, fundsCol, settingsDoc, txCol } from './api'
import { nextInterestDate } from './interest'
import { ordersCol, runDoc, runsCol, salariesCol } from './orders'
import { DEFAULT_SETTINGS, type Fund, type FundOrder, type FundRun, type FundSettings, type FundTransaction, type Salary } from './types'

interface FundData {
  // Người đang đăng nhập (quỹ và giao dịch là dữ liệu dùng chung, cài đặt là của riêng người này)
  actor: Actor
  funds: Fund[]
  transactions: FundTransaction[]
  orders: FundOrder[] // lệnh chuyển soạn sẵn, xếp theo số thứ tự (position 1, 2, 3...)
  settings: FundSettings
  loading: boolean
  // Hiển thị số tiền, tự ẩn nếu bật "Ẩn số dư" trong cài đặt
  showMoney: (n: number) => string
}

const FundContext = createContext<FundData | null>(null)

const SETTINGS_CACHE_KEY = 'fund-settings'

// Skeleton cần biết cài đặt (vd có hiện nút số tiền nhanh không) trước khi Firestore tải xong
export function getCachedSettings(): FundSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

const OPTS = { serverTimestamps: 'estimate' } as const

const toDate = (v: unknown) => (v ? (v as Timestamp).toDate() : null)

function toFund(id: string, d: DocumentData): Fund {
  return {
    id,
    name: d.name ?? '',
    icon: d.icon ?? '💰',
    color: d.color ?? 'from-amber-400 to-orange-500',
    interestRate: d.interestRate ?? 0,
    balance: d.balance ?? 0,
    transferred: d.transferred ?? false,
    interestAnchor: toDate(d.interestAnchor),
    interestPeriods: d.interestPeriods ?? 0,
    position: d.position ?? Number.MAX_SAFE_INTEGER,
    createdAt: toDate(d.createdAt),
  }
}

// Xếp nhóm quỹ theo số thứ tự (quỹ cũ chưa có số thì theo lúc tạo), rồi đánh lại 1, 2, 3... cho liên tục
function sortFunds(list: Fund[]): Fund[] {
  return [...list]
    .sort((a, b) => a.position - b.position || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
    .map((f, i) => ({ ...f, position: i + 1 }))
}

function toOrder(id: string, d: DocumentData): FundOrder {
  return {
    id,
    type: d.type ?? 'transfer',
    fromFundId: d.fromFundId ?? null,
    toFundId: d.toFundId ?? null,
    amount: d.amount ?? 0,
    allBalance: !!d.allBalance,
    note: d.note ?? '',
    position: d.position ?? Number.MAX_SAFE_INTEGER,
    createdAt: toDate(d.createdAt),
  }
}

// Xếp lệnh theo số thứ tự (lệnh cũ chưa có số thì theo lúc tạo), rồi đánh lại 1, 2, 3... cho liên tục
function sortOrders(list: FundOrder[]): FundOrder[] {
  return [...list]
    .sort((a, b) => a.position - b.position || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
    .map((o, i) => ({ ...o, position: i + 1 }))
}

function toTransaction(id: string, d: DocumentData): FundTransaction {
  return {
    id,
    fundId: d.fundId,
    type: d.type,
    amount: d.amount ?? 0,
    note: d.note ?? '',
    date: toDate(d.date) ?? new Date(),
    createdByName: d.createdByName ?? '',
    peerFundId: d.peerFundId ?? null,
    pairId: d.pairId ?? null,
    orderId: d.orderId ?? null,
    runId: d.runId ?? null,
    deleted: !!d.deleted,
    deletedByName: d.deletedByName ?? '',
    createdAt: toDate(d.createdAt),
  }
}

// Danh sách nhóm quỹ realtime, xếp theo số thứ tự. null = đang tải.
// Dùng chung cho app Quỹ và app Ghi chú (nạp / rút quỹ ở màn hình Xem ghi chú), cùng khoá nhớ tạm.
export function useFundList(uid: string | undefined): Fund[] | null {
  return useLiveQuery<Fund[]>(uid ? familyKey('funds') : null, (on) =>
    onSnapshot(query(fundsCol(), orderBy('createdAt', 'asc')), (snap) =>
      on(sortFunds(snap.docs.map((d) => toFund(d.id, d.data(OPTS)))), snap.metadata.fromCache),
    ),
  )
}

export function FundProvider({ actor, children }: { actor: Actor | null; children: ReactNode }) {
  const uid = actor?.uid
  const interestTried = useRef(new Set<string>())

  // Dữ liệu realtime có nhớ tạm (liveQuery): mở lại app Quỹ / vuốt qua lại thì hiện ngay dữ liệu đã có, không chớp skeleton
  const funds = useFundList(uid)
  const transactions = useLiveQuery<FundTransaction[]>(uid ? familyKey('transactions') : null, (on) =>
    onSnapshot(query(txCol(), orderBy('date', 'desc'), limit(1000)), (snap) =>
      on(
        snap.docs.map((d) => toTransaction(d.id, d.data(OPTS))),
        snap.metadata.fromCache,
      ),
    ),
  )
  const orders = useLiveQuery<FundOrder[]>(uid ? familyKey('fundOrders') : null, (on) =>
    onSnapshot(query(ordersCol(), orderBy('createdAt', 'asc')), (snap) =>
      on(sortOrders(snap.docs.map((d) => toOrder(d.id, d.data(OPTS)))), snap.metadata.fromCache),
    ),
  )
  const settings = useLiveQuery<FundSettings>(uid ? `user:${uid}:fundSettings` : null, (on) =>
    onSnapshot(settingsDoc(uid!), (snap) => {
      const v = { ...DEFAULT_SETTINGS, ...snap.data() }
      on(v, snap.metadata.fromCache)
      try {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(v))
      } catch {
        // Không lưu được cache thì skeleton dùng cài đặt mặc định
      }
    }),
  )

  // Tự cộng lãi cho các quỹ đã đến hạn (mỗi quỹ thử 1 lần mỗi lần mở app)
  useEffect(() => {
    if (!uid || !funds || !navigator.onLine) return
    const now = new Date()
    for (const f of funds) {
      const due = nextInterestDate(f)
      if (due && due <= now && !interestTried.current.has(f.id)) {
        interestTried.current.add(f.id)
        applyDueInterest(f.id).catch((e) => console.error('Cộng lãi thất bại', e))
      }
    }
  }, [uid, funds])

  const s = settings ?? DEFAULT_SETTINGS
  const value: FundData = {
    actor: actor ?? { uid: '', name: '' },
    funds: funds ?? [],
    transactions: transactions ?? [],
    orders: orders ?? [],
    settings: s,
    loading: !uid || !funds || !transactions || !orders || !settings,
    showMoney: (n) => (s.hideBalance ? '•••••• ₫' : formatMoney(n)),
  }

  return <FundContext.Provider value={value}>{children}</FundContext.Provider>
}

export function useFund() {
  const ctx = useContext(FundContext)
  if (!ctx) throw new Error('useFund phải được dùng bên trong FundProvider')
  return ctx
}

// Đợt thực thi của 1 tháng (màn hình Thực thi): trạng thái đợt + lương từng người, cập nhật realtime. null = đang tải.
export function useFundRun(month: string): { run: FundRun; salaries: Salary[] } | null {
  const run = useLiveQuery<FundRun>(familyKey('fundRuns', month), (on) =>
    onSnapshot(runDoc(month), (snap) => on(toRun(month, snap.data(OPTS) ?? {}), snap.metadata.fromCache)),
  )
  const salaries = useLiveQuery<Salary[]>(familyKey('fundRuns', month, 'salaries'), (on) =>
    onSnapshot(salariesCol(month), (snap) =>
      on(
        snap.docs.map((d) => {
          const v = d.data(OPTS)
          return { uid: d.id, name: v.name ?? '', amount: v.amount ?? 0, fundId: v.fundId ?? null, updatedAt: toDate(v.updatedAt) }
        }),
        snap.metadata.fromCache,
      ),
    ),
  )
  return run && salaries ? { run, salaries } : null
}

function toRun(month: string, d: DocumentData): FundRun {
  const executed: Record<string, Date> = {}
  for (const [id, at] of Object.entries(d.executed ?? {})) if (at) executed[id] = (at as Timestamp).toDate()
  return {
    month,
    summarizedByName: d.summarizedByName ?? null,
    summarizedAt: toDate(d.summarizedAt),
    executed,
    balances: d.balances ?? null,
    total: d.total ?? null,
  }
}

// Mọi đợt thực thi đã có (mỗi tháng 1 đợt), realtime; dùng cho màn hình Thống kê. null = đang tải.
export function useFundRuns(): Map<string, FundRun> | null {
  return useLiveQuery<Map<string, FundRun>>(familyKey('fundRuns'), (on) =>
    onSnapshot(runsCol(), (snap) =>
      on(new Map(snap.docs.map((d) => [d.id, toRun(d.id, d.data(OPTS))])), snap.metadata.fromCache),
    ),
  )
}
