// 1 thẻ (dòng) trong ghi chú, vd "Mua cà chua". Thứ tự trong mảng = thứ tự ưu tiên (số 1 = đầu mảng).
export interface NoteItem {
  id: string
  text: string
  done: boolean // đã làm xong
  doneByName: string // ai đánh dấu xong ("" = chưa xong)
  money: NoteMoney[] // các lần nạp / rút quỹ cho riêng thẻ này (vd "Mua cà chua" rút 30.000 ₫)
}

// 1 lần nạp / rút quỹ gắn với 1 thẻ nội dung; giao dịch thật nằm ở app Quỹ (txId)
export interface NoteMoney {
  type: 'deposit' | 'withdraw'
  amount: number
  fundId: string
  fundName: string
  txId: string
  byName: string
  at: Date
}

// Tổng tiền của 1 thẻ: rút là âm, nạp là dương
export const moneyTotal = (item: Pick<NoteItem, 'money'>) => item.money.reduce((s, m) => s + (m.type === 'deposit' ? m.amount : -m.amount), 0)

// Ghi chú gửi đến 1 thành viên trong gia đình (hoặc cho chính mình), vd "Đi chợ" gồm các thẻ "Mua cà chua", "Mua cá".
// Số thứ tự (position 1..n) = thứ tự ưu tiên giữa các ghi chú của cùng 1 người nhận.
export interface Note {
  id: string
  name: string // tên ghi chú; dữ liệu cũ chưa có tên = ""
  position: number
  toUid: string
  toName: string
  fromUid: string
  fromName: string
  items: NoteItem[]
  createdAt: Date | null
}

// Thẻ ghi chú đã từng nhập (màn hình Thẻ ghi chú): dùng để gợi ý khi tạo ghi chú.
// Không trùng nội dung; số thứ tự (position 1..n) = thứ tự ưu tiên trong danh sách gợi ý.
export interface NoteCard {
  id: string
  text: string
  position: number
  createdAt: Date | null
}

// Cài đặt của app Ghi chú, RIÊNG từng tài khoản
export interface NoteSettings {
  defaultFundId: string | null // quỹ chọn sẵn khi nạp / rút ở màn hình Xem ghi chú
}

export const DEFAULT_NOTE_SETTINGS: NoteSettings = { defaultFundId: null }

// Độ dài tối đa 1 thẻ
export const MAX_TEXT = 100

// Chuẩn hoá nội dung để so trùng: bỏ khoảng trắng thừa, không phân biệt hoa thường
export const sameKey = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()

// Bỏ dấu tiếng Việt để gợi ý khi gõ không dấu, vd "ca chua" vẫn ra "Mua cà chua"
export const foldKey = (text: string) =>
  sameKey(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')

// Nội dung các thẻ, vd "Mua cà chua, Mua tôm"
export const noteText = (items: Pick<NoteItem, 'text'>[]) => items.map((i) => i.text).join(', ')

// Tên hiển thị của ghi chú (ghi chú cũ chưa có tên thì lấy nội dung các thẻ)
export const noteTitle = (note: Pick<Note, 'name' | 'items'>) => note.name || noteText(note.items) || 'Ghi chú'

// Ghi chú hoàn thành khi mọi thẻ trong đó đã làm xong
export const noteDone = (note: Pick<Note, 'items'>) => note.items.length > 0 && note.items.every((i) => i.done)

// Ghi chú của giao dịch khi nạp / rút quỹ cho 1 thẻ: "Tên ghi chú: nội dung thẻ", vd "Đi chợ: Mua cà chua"
export const itemMemo = (note: Pick<Note, 'name'>, item: Pick<NoteItem, 'text'>) => (note.name ? `${note.name}: ${item.text}` : item.text)
