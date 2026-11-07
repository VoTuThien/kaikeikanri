// Tách dữ liệu từ CHỮ đọc được trên ảnh hoá đơn (Tesseract.js trả về chữ thô, hay sai dấu / nhầm chữ O với số 0):
// - Số tiền: ưu tiên số nằm trên dòng có chữ "tổng cộng / tổng tiền / thanh toán / phải trả / total..." (hoặc dòng ngay dưới),
//   bỏ qua "tiền mặt / khách đưa / tiền thừa / giảm giá / VAT..."; trả về vài số để người dùng chạm chọn nếu số đầu sai
// - Ngày: dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy hoặc "ngày .. tháng .. năm ...", không lấy ngày ở tương lai
// - Tên cửa hàng: dòng chữ đầu tiên trông giống tên (bỏ địa chỉ, SĐT, mã số thuế...)
// LƯU Ý iOS 15.1: KHÔNG dùng regex lookbehind (?<=...) / (?<!...) — Safari < 16.4 báo lỗi cú pháp làm hỏng cả trang.

import { MAX_MONEY } from '../../../lib/format'

export interface ReceiptData {
  amounts: number[] // các số tiền tìm thấy, khả năng là TỔNG TIỀN cao nhất đứng đầu (tối đa 4)
  date: Date | null
  store: string
}

// Bỏ dấu tiếng Việt + chữ thường, để so khớp từ khoá khi OCR đọc sai dấu
export function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

const STRONG = ['tong cong', 'tong tien', 'tong thanh toan', 'thanh toan', 'can thanh toan', 'phai tra', 'phai thanh toan', 'tong so tien', 'total', 'grand total', 'amount due', 'cong tien hang', 'tong hoa don']
const WEAK = ['tong', 'cong', 'thanh tien', 'so tien', 'tam tinh', 'subtotal']
const NEGATIVE = ['tien mat', 'khach dua', 'tien khach', 'tien thua', 'tra lai', 'thoi lai', 'change', 'cash', 'tien thoi']
const MINUS = ['giam gia', 'chiet khau', 'khuyen mai', 'discount', 'vat', 'thue', 'tax', 'phi dich vu', 'don gia', 'sl', 'so luong']

const has = (line: string, words: string[]) => words.some((w) => line.includes(w))

// Sửa vài lỗi OCR hay gặp trong số: chữ O / o / D sát chữ số -> 0, chữ l / I / | sát chữ số -> 1
// (kể cả sau dấu phân cách: "10.OOO" -> "10.000"); lặp tới khi không đổi nữa vì mỗi lần chỉ sửa được 1 ký tự sát số
function fixDigits(line: string) {
  let prev = ''
  let s = line
  for (let i = 0; i < 8 && s !== prev; i++) {
    prev = s
    s = s
      .replace(/(\d[.,]?)[oOD]/g, (_, d: string) => `${d}0`)
      .replace(/[oO]([.,]?\d)/g, (_, d: string) => `0${d}`)
      .replace(/(\d[.,]?)[lI|]/g, (_, d: string) => `${d}1`)
      .replace(/[lI|]([.,]?\d)/g, (_, d: string) => `1${d}`)
  }
  // OCR hay chèn khoảng trắng quanh dấu phân cách: "245. 000", "245 .000" -> "245.000"
  return s.replace(/(\d)\s*([.,])\s+(\d{3})(?!\d)/g, '$1$2$3').replace(/(\d)\s+([.,])(\d{3})(?!\d)/g, '$1$2$3')
}

// Dòng thông tin liên hệ / mã số: số trên dòng này không phải tiền
const CONTACT = ['sdt', 'dt:', 'dt ', 'tel', 'hotline', 'mst', 'ma so thue', 'so hd', 'so hoa don', 'ma hd', 'stk', 'tai khoan']

// Các số tiền trong 1 dòng: "125.000", "125,000", "125 000", "1.250.000đ", "125000", "125k"
export function moneyIn(raw: string): number[] {
  const line = fixDigits(raw)
  const out: number[] = []
  // "125k" / "1.5k"
  for (const m of line.matchAll(/(\d+(?:[.,]\d+)?)\s*k\b/gi)) {
    const v = Math.round(Number(m[1].replace(',', '.')) * 1000)
    if (v >= 1000) out.push(v)
  }
  // Số có dấu phân cách hàng nghìn (. hoặc ,) hoặc số liền >= 4 chữ số.
  // Không coi khoảng trắng là dấu phân cách: "1 100.000" (số lượng + giá) sẽ thành 1.100.000
  for (const m of line.matchAll(/\d{1,3}(?:[.,]\d{3})+(?!\d)|\d{4,}/g)) {
    const text = m[0]
    const digits = text.replace(/\D/g, '')
    // Bỏ số điện thoại / mã số thuế / mã hoá đơn (số dài liền, hoặc bắt đầu bằng 0)
    if (!/[.,]/.test(text) && (digits.length >= 8 || digits.startsWith('0'))) continue
    // Bỏ năm (2026) và giờ dạng 1430
    if (digits.length === 4 && /^(19|20)\d\d$/.test(digits)) continue
    const v = Number(digits)
    if (v >= 1000 && v <= MAX_MONEY) out.push(v)
  }
  return out
}

function pickDate(lines: string[], today: Date): Date | null {
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 1)
  const make = (d: number, m: number, y: number) => {
    const year = y < 100 ? 2000 + y : y
    if (m < 1 || m > 12 || d < 1 || d > 31 || year < 2000) return null
    const date = new Date(year, m - 1, d)
    if (date.getMonth() !== m - 1 || date > limit) return null
    return date
  }
  for (const raw of lines) {
    const line = fold(fixDigits(raw))
    const vn = line.match(/ngay\s*(\d{1,2})\s*thang\s*(\d{1,2})\s*nam\s*(\d{2,4})/)
    const d = vn ? make(+vn[1], +vn[2], +vn[3]) : null
    if (d) return d
    for (const m of line.matchAll(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4}|\d{2})(?!\d)/g)) {
      const date = make(+m[1], +m[2], +m[3])
      if (date) return date
    }
  }
  return null
}

function pickStore(lines: string[]): string {
  const skip = ['hoa don', 'dia chi', 'dc:', 'd/c', 'dt:', 'dt ', 'sdt', 'tel', 'hotline', 'mst', 'ma so thue', 'so:', 'ngay', 'gio', 'thu ngan', 'nhan vien', 'ban:', 'phieu', 'www', 'http', '.com', '.vn']
  for (const raw of lines.slice(0, 6)) {
    const line = raw.replace(/[^\p{L}\p{N}\s&.'-]/gu, ' ').replace(/\s+/g, ' ').trim()
    const letters = (line.match(/\p{L}/gu) ?? []).length
    if (letters < 3 || letters < line.length * 0.6) continue
    if (has(fold(line), skip)) continue
    return line.slice(0, 60)
  }
  return ''
}

export function parseReceipt(text: string, today = new Date()): ReceiptData {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // Chấm điểm từng số tiền theo từ khoá của dòng chứa nó (và dòng ngay trên, vì nhiều hoá đơn để số ở dòng dưới chữ "Tổng cộng")
  const score = new Map<number, number>()
  lines.forEach((raw, i) => {
    const line = fold(raw)
    if (has(line, CONTACT)) return
    const amounts = moneyIn(raw)
    if (amounts.length === 0) return
    const prev = i > 0 && moneyIn(lines[i - 1]).length === 0 ? fold(lines[i - 1]) : ''
    let s = 0
    if (has(line, STRONG)) s += 10
    else if (has(prev, STRONG)) s += 8
    else if (has(line, WEAK) || has(prev, WEAK)) s += 3
    if (has(line, NEGATIVE)) s -= 12
    if (has(line, MINUS)) s -= 5
    if (/(d|vnd|₫)\s*$/i.test(fold(raw)) || /đ|₫|vnd/i.test(raw)) s += 1
    if (i >= lines.length / 2) s += 1 // tổng tiền thường nằm ở nửa dưới hoá đơn
    // Trên 1 dòng có nhiều số (SL, đơn giá, thành tiền) thì số cuối cùng thường là tiền của dòng
    const last = amounts[amounts.length - 1]
    for (const v of amounts) {
      const bonus = v === last ? 1 : 0
      score.set(v, Math.max(score.get(v) ?? -Infinity, s + bonus))
    }
  })

  const amounts = [...score.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([v]) => v)
    .slice(0, 4)

  return { amounts, date: pickDate(lines, today), store: pickStore(lines) }
}
