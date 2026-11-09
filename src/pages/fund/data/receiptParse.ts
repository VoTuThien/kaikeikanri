// Tách dữ liệu từ CHỮ đọc được trên ảnh hoá đơn (Tesseract.js trả về chữ thô, hay sai dấu / nhầm chữ O với số 0):
// - Số tiền: ưu tiên số nằm trên dòng có chữ "tổng cộng / tổng tiền / thanh toán / phải trả / total..." (hoặc dòng ngay dưới),
//   bỏ qua "tiền mặt / khách đưa / tiền thừa / giảm giá / VAT..."; trả về vài số để người dùng chạm chọn nếu số đầu sai
// - Ngày: dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy hoặc "ngày .. tháng .. năm ...", không lấy ngày ở tương lai
// - Tên cửa hàng: dòng chữ đầu tiên trông giống tên (bỏ địa chỉ, SĐT, mã số thuế...)
// LƯU Ý iOS 15.1: KHÔNG dùng regex lookbehind (?<=...) / (?<!...) — Safari < 16.4 báo lỗi cú pháp làm hỏng cả trang.

import { MAX_MONEY } from '../../../lib/format'

// Loại hoá đơn: mỗi loại có cách tách riêng (chọn ở ô "Loại hoá đơn" của màn hình Đọc hoá đơn)
export type ReceiptKind = 'general' | 'bhx' | 'kiotviet'
export const RECEIPT_KINDS: { value: ReceiptKind; label: string; store: string }[] = [
  { value: 'bhx', label: 'Bách Hoá Xanh (BHX)', store: 'Bách Hoá Xanh' },
  { value: 'kiotviet', label: 'KiotViet', store: '' },
  { value: 'general', label: 'Hoá đơn khác', store: '' },
]

// 1 sản phẩm trên hoá đơn: tên, số lượng (SL, có thể lẻ: 0,274 kg), thành tiền
export interface ReceiptItem {
  name: string
  qty: number
  amount: number
}

export interface ReceiptData {
  amounts: number[] // các số tiền tìm thấy, khả năng là TỔNG TIỀN cao nhất đứng đầu (tối đa 4)
  date: Date | null
  store: string
  items: ReceiptItem[] // các sản phẩm (chỉ loại hoá đơn tách được từng món, vd BHX)
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
    // Ngày đứng riêng (trước nó không phải chữ số), dấu phân cách liền: tránh ghép nhầm "...463 - 01/11" của mã chứng từ thành ngày
    for (const m of line.matchAll(/(?:^|\D)(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?!\d)/g)) {
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

const toLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

export function parseReceipt(text: string, today = new Date(), kind: ReceiptKind = 'general'): ReceiptData {
  if (kind === 'bhx') return parseBhx(text, today)
  if (kind === 'kiotviet') return parseKiotViet(text, today)
  const lines = toLines(text)

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

  return { amounts, date: pickDate(lines, today), store: pickStore(lines), items: [] }
}

// ---- Hoá đơn Bách Hoá Xanh ("PHIẾU THANH TOÁN BÁCH HÓA XANH", bản trong app BHX) ----
// Bảng 3 cột "SL | Giá bán (có VAT) | Thành tiền"; mỗi sản phẩm 2 dòng:
//   cánh gà                                         <- tên (dài thì xuống nhiều dòng)
//   0,274   108.000 64.800 (VAT:5%)   17.755        <- SL (đầu dòng, có thể lẻ) ... thành tiền (cuối dòng)
// Chỉ lấy SL + thành tiền (bỏ cột giá bán, giá gạch ngang). Số tiền rút = "Phải thanh toán" (không có thì = tổng thành tiền).

// Dòng số liệu của 1 sản phẩm: bắt đầu bằng SL, kết thúc bằng thành tiền
const ITEM_ROW = /^([0-9lI|]+(?:[.,]\d+)?)\s+(.*?)(\d{1,3}(?:\.\d{3})+|\d{1,7})\s*$/

function parseQty(raw: string) {
  return Number(raw.replace(/[lI|]/g, '1').replace(',', '.')) || 0
}

function parseBhx(text: string, today: Date): ReceiptData {
  const lines = toLines(text)
  const folded = lines.map(fold)
  // Bảng bắt đầu sau dòng tiêu đề cột (SL / Giá bán / Thành tiền), kết thúc ở dòng "Phải thanh toán"
  const head = folded.findIndex((l) => l.includes('thanh tien') && (l.includes('gia ban') || /\bsl\b/.test(l)))
  let end = folded.findIndex((l) => l.includes('phai thanh toan'))
  if (end < 0) end = lines.length

  const items: ReceiptItem[] = []
  let name: string[] = []
  for (let i = head + 1; i < end; i++) {
    const line = fixDigits(lines[i])
    const m = line.match(ITEM_ROW)
    // Dòng số liệu: có SL ở đầu + thành tiền ở cuối, và có "VAT" hoặc ít nhất 1 số ở giữa (giá bán)
    if (m && (/vat/i.test(m[2]) || /\d/.test(m[2]))) {
      const amount = Number(m[3].replace(/\D/g, ''))
      if (amount > 0) items.push({ name: name.join(' ').trim() || 'Sản phẩm', qty: parseQty(m[1]), amount })
      name = []
    } else if (/\p{L}/u.test(lines[i])) {
      name.push(lines[i])
    }
  }

  // "Phải thanh toán: 210.898" (số có thể nằm ở dòng dưới)
  let total = 0
  if (end < lines.length) {
    const here = moneyIn(lines[end])
    const next = end + 1 < lines.length ? moneyIn(lines[end + 1]) : []
    total = here[here.length - 1] ?? next[next.length - 1] ?? 0
  }
  const sum = items.reduce((s, it) => s + it.amount, 0)
  const amounts = [...new Set([total, sum].filter((v) => v > 0))]

  return { amounts, date: pickDate(lines, today), store: 'Bách Hoá Xanh', items }
}

// ---- Hoá đơn in từ phần mềm KiotViet ("Powered by KiotViet", vd quán cà phê) ----
// Bảng 4 cột "Tên hàng | Đ.Giá | SL | Thành tiền"; mỗi sản phẩm 1 dòng (tên dài có thể xuống dòng):
//   Trà Lựu Hibiscus     55,000 x 1         55,000
// Tên cửa hàng = dòng đầu hoá đơn. Số tiền rút = "Tổng Cộng" (đã trừ chiết khấu; không đọc được thì = "Tổng tiền hàng" / tổng thành tiền).

// Tên ... đơn giá [x] SL thành tiền; dấu "x" có thể bị đọc nhầm nên chấp nhận 1 ký tự bất kỳ không phải số
const KV_ROW = /^(.*?\S)\s+\d{1,3}(?:[.,]\d{3})+\s*[^\d\s]?\s*([0-9lI|]+(?:[.,]\d{1,3})?)\s+(\d{1,3}(?:[.,]\d{3})+|\d{1,7})\s*$/

function parseKiotViet(text: string, today: Date): ReceiptData {
  const lines = toLines(text)
  const folded = lines.map(fold)
  const head = folded.findIndex((l) => l.includes('thanh tien') && (l.includes('ten hang') || l.includes('gia')))
  const isFooter = (l: string) => /^tong|chiet khau|giam gia|thanh toan|phai tra/.test(l)
  let end = folded.findIndex((l, i) => i > head && isFooter(l))
  if (end < 0) end = lines.length

  const items: ReceiptItem[] = []
  let name: string[] = []
  for (let i = head + 1; i < end; i++) {
    const m = fixDigits(lines[i]).match(KV_ROW)
    if (m) {
      const amount = Number(m[3].replace(/\D/g, ''))
      if (amount > 0) items.push({ name: [...name, m[1]].join(' ').trim(), qty: parseQty(m[2]), amount })
      name = []
    } else if (/\p{L}/u.test(lines[i])) {
      name.push(lines[i])
    }
  }

  // "Tổng Cộng: 110,000" (ưu tiên hơn "Tổng tiền hàng" vì đã trừ chiết khấu); số có thể nằm ở dòng dưới
  const moneyAt = (words: string) => {
    const i = folded.findIndex((l, n) => n >= end && l.includes(words))
    if (i < 0) return 0
    const here = moneyIn(lines[i])
    const next = i + 1 < lines.length ? moneyIn(lines[i + 1]) : []
    return here[here.length - 1] ?? next[next.length - 1] ?? 0
  }
  const total = moneyAt('tong cong') || moneyAt('thanh toan') || moneyAt('tong tien')
  const amounts = [...new Set([total, itemsTotal(items)].filter((v) => v > 0))]

  return { amounts, date: pickDate(lines, today), store: pickStore(lines), items }
}

// Tổng thành tiền các sản phẩm, để so với số phải thanh toán (lệch = OCR đọc sót / sai 1 dòng)
export const itemsTotal = (items: ReceiptItem[]) => items.reduce((s, it) => s + it.amount, 0)
