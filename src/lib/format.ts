const number = new Intl.NumberFormat('vi-VN')
const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })

export const formatNumber = (n: number) => number.format(Math.round(n))
export const formatMoney = (n: number) => `${formatNumber(n)} ₫`
// Dạng rút gọn cho ô nhỏ, ví dụ "12,3 Tr ₫"
export const formatMoneyCompact = (n: number) => `${compact.format(Math.round(n))} ₫`

// 4.5 -> "4,5%"
export const formatPercent = (n: number) => `${n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`

// Số tiền tối đa nhập được ở mọi ô nhập tiền (1 tỷ)
export const MAX_MONEY = 1_000_000_000

// "1.000.000" -> 1000000
export const parseMoney = (text: string) => Number(text.replace(/\D/g, '')) || 0

export const formatDate = (d: Date) =>
  d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const formatMonth = (d: Date) => `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`

const pad = (n: number) => String(n).padStart(2, '0')

// Date -> "YYYY-MM-DD" cho <input type="date">
export const toDateInputValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// "YYYY-MM-DD" -> Date, lấy giờ hiện tại để các giao dịch cùng ngày vẫn đúng thứ tự
export function fromDateInputValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  const now = new Date()
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
}
