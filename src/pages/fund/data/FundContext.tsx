import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { limit, onSnapshot, orderBy, query, type DocumentData, type Timestamp } from 'firebase/firestore'
import { formatMoney } from '../../../lib/format'
import type { Actor } from '../../../lib/firestore'
import { applyDueInterest, fundsCol, settingsDoc, txCol } from './api'
import { nextInterestDate } from './interest'
import { DEFAULT_SETTINGS, type Fund, type FundSettings, type FundTransaction } from './types'

interface FundData {
  // Người đang đăng nhập (quỹ và giao dịch là dữ liệu dùng chung, cài đặt là của riêng người này)
  actor: Actor
  funds: Fund[]
  transactions: FundTransaction[]
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

const toDate = (v: unknown) => (v ? (v as Timestamp).toDate() : null)

function toFund(id: string, d: DocumentData): Fund {
  return {
    id,
    name: d.name ?? '',
    icon: d.icon ?? '💰',
    color: d.color ?? 'from-amber-400 to-orange-500',
    interestRate: d.interestRate ?? 0,
    balance: d.balance ?? 0,
    interestAnchor: toDate(d.interestAnchor),
    interestPeriods: d.interestPeriods ?? 0,
    createdAt: toDate(d.createdAt),
  }
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
  }
}

export function FundProvider({ actor, children }: { actor: Actor | null; children: ReactNode }) {
  const uid = actor?.uid
  const [funds, setFunds] = useState<Fund[] | null>(null)
  const [transactions, setTransactions] = useState<FundTransaction[] | null>(null)
  const [settings, setSettings] = useState<FundSettings | null>(null)
  const interestTried = useRef(new Set<string>())

  useEffect(() => {
    if (!uid) return
    const opts = { serverTimestamps: 'estimate' } as const
    const unsubs = [
      onSnapshot(query(fundsCol(), orderBy('createdAt', 'asc')), (snap) =>
        setFunds(snap.docs.map((d) => toFund(d.id, d.data(opts)))),
      ),
      onSnapshot(query(txCol(), orderBy('date', 'desc'), limit(1000)), (snap) =>
        setTransactions(snap.docs.map((d) => toTransaction(d.id, d.data(opts)))),
      ),
      onSnapshot(settingsDoc(uid), (snap) => {
        const s = { ...DEFAULT_SETTINGS, ...snap.data() }
        setSettings(s)
        try {
          localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s))
        } catch {
          // Không lưu được cache thì skeleton dùng cài đặt mặc định
        }
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [uid])

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
    settings: s,
    loading: !uid || !funds || !transactions || !settings,
    showMoney: (n) => (s.hideBalance ? '•••••• ₫' : formatMoney(n)),
  }

  return <FundContext.Provider value={value}>{children}</FundContext.Provider>
}

export function useFund() {
  const ctx = useContext(FundContext)
  if (!ctx) throw new Error('useFund phải được dùng bên trong FundProvider')
  return ctx
}
