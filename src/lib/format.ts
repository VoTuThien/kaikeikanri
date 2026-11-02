const number = new Intl.NumberFormat('vi-VN')
const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })

export const formatNumber = (n: number) => number.format(Math.round(n))
export const formatMoney = (n: number) => `${formatNumber(n)} ₫`
// Dạng rút gọn cho ô nhỏ, ví dụ "12,3 Tr ₫"
export const formatMoneyCompact = (n: number) => `${compact.format(Math.round(n))} ₫`

// 4.5 -> "4,5%"
export const formatPercent = (n: number) => `${n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`

// Số tiền tối đa nhập được ở mọi ô nhập tiền (99 tỷ)
export const MAX_MONEY = 99_000_000_000

// ---- Đọc số tiền bằng chữ (hiện dưới ô nhập số tiền) ----
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const UNITS = ['', ' nghìn', ' triệu', ' tỷ']

// Đọc 1 nhóm 3 chữ số. full = không phải nhóm đầu tiên (phải đọc đủ "không trăm", "linh")
function readTriple(n: number, full: boolean) {
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const u = n % 10
  const words: string[] = []
  if (full || h > 0) words.push(`${DIGITS[h]} trăm`)
  if (t === 0) {
    if (u > 0) words.push(words.length ? `linh ${DIGITS[u]}` : DIGITS[u])
  } else if (t === 1) {
    words.push('mười')
    if (u > 0) words.push(u === 5 ? 'lăm' : DIGITS[u])
  } else {
    words.push(`${DIGITS[t]} mươi`)
    if (u === 1) words.push('mốt')
    else if (u === 4) words.push('tư')
    else if (u === 5) words.push('lăm')
    else if (u > 0) words.push(DIGITS[u])
  }
  return words.join(' ')
}

// 1500000 -> "Một triệu năm trăm nghìn đồng"; 0 -> ""
export function moneyToWords(n: number) {
  n = Math.floor(Math.abs(n))
  if (!n) return ''
  // Tách nhóm 3 chữ số từ phải sang: [đơn vị, nghìn, triệu, tỷ] (tối đa 99 tỷ nên nhóm tỷ < 1000)
  const groups: number[] = []
  for (let x = n; x > 0; x = Math.floor(x / 1000)) groups.push(x % 1000)
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue
    parts.push(readTriple(groups[i], parts.length > 0) + UNITS[i])
  }
  const text = `${parts.join(' ')} đồng`
  return text[0].toUpperCase() + text.slice(1)
}

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
