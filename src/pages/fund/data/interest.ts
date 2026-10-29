import type { Fund } from './types'

// Cộng tháng, giữ nguyên ngày; tháng thiếu ngày (vd 31/2) thì lùi về ngày cuối tháng
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

// Lãi suất %/năm -> tỉ lệ mỗi tháng
export const monthlyRate = (annualPercent: number) => annualPercent / 100 / 12

// Ngày cộng lãi tiếp theo của quỹ, null nếu quỹ không tính lãi
export function nextInterestDate(fund: Fund): Date | null {
  if (!fund.interestRate || !fund.interestAnchor) return null
  return addMonths(fund.interestAnchor, fund.interestPeriods + 1)
}

// Số dư ước tính sau n tháng với lãi kép hàng tháng
export const projectBalance = (balance: number, annualPercent: number, months: number) =>
  balance * Math.pow(1 + monthlyRate(annualPercent), months)
