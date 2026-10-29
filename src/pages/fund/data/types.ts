export interface Fund {
  id: string
  name: string
  icon: string
  color: string // class gradient Tailwind, ví dụ "from-amber-400 to-orange-500"
  interestRate: number // lãi suất %/năm, 0 = không tính lãi
  balance: number // số dư hiện tại (VND)
  interestAnchor: Date | null // mốc bắt đầu tính lãi
  interestPeriods: number // số tháng đã cộng lãi kể từ mốc
  createdAt: Date | null
}

export type TxType = 'deposit' | 'withdraw' | 'interest'

export interface FundTransaction {
  id: string
  fundId: string
  type: TxType
  amount: number // luôn là số dương
  note: string
  date: Date
  createdByName: string // tên người nạp / rút, rỗng với giao dịch lãi tự động
}

export interface FundSettings {
  hideBalance: boolean
  showQuickAmounts: boolean
  defaultInterestRate: number
}

export const DEFAULT_SETTINGS: FundSettings = {
  hideBalance: false,
  showQuickAmounts: true,
  defaultInterestRate: 0,
}

export interface FundInput {
  name: string
  icon: string
  color: string
  interestRate: number
}
