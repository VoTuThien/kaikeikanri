export interface Fund {
  id: string
  name: string
  icon: string
  color: string // class gradient Tailwind, ví dụ "from-amber-400 to-orange-500"
  interestRate: number // lãi suất %/năm, 0 = không tính lãi
  balance: number // số dư hiện tại (VND)
  transferred: boolean // tiền đã chuyển đi, không còn trong tài khoản -> không tính vào tổng số dư
  interestAnchor: Date | null // mốc bắt đầu tính lãi
  interestPeriods: number // số tháng đã cộng lãi kể từ mốc
  position: number // số thứ tự hiển thị (1, 2, 3... liên tục, không trùng); mọi danh sách / ô chọn quỹ xếp theo số này
  createdAt: Date | null
}

// transfer_out / transfer_in: 2 giao dịch của 1 lần chuyển tiền giữa 2 quỹ (peerFundId = quỹ bên kia)
export type TxType = 'deposit' | 'withdraw' | 'interest' | 'transfer_out' | 'transfer_in'

export interface FundTransaction {
  id: string
  fundId: string
  type: TxType
  amount: number // luôn là số dương
  note: string
  date: Date
  createdByName: string // tên người nạp / rút, rỗng với giao dịch lãi tự động
  peerFundId: string | null // giao dịch chuyển: quỹ bên kia
  pairId: string | null // giao dịch chuyển: id giao dịch còn lại của cặp chuyển đi / nhận về (dữ liệu cũ chưa có)
  orderId: string | null // tạo bởi lệnh chuyển ở màn hình Thực thi
  runId: string | null // thuộc đợt thực thi (tháng) nào; giao dịch nạp lương thực lãnh có runId mà không có orderId
  deleted: boolean // đã xoá (vẫn hiện trên Tra cứu với nền xám, không tính vào tổng, số dư quỹ đã được hoàn lại)
  deletedByName: string
  createdAt: Date | null // lúc ghi giao dịch (so với lúc tổng kết để biết giao dịch đã bị tổng kết chưa)
  receipt: string | null // rút theo hoá đơn (màn hình Đọc hoá đơn): loại hoá đơn, vd "bhx"
  items: TxItem[] // các sản phẩm trên hoá đơn (rỗng nếu không phải rút theo hoá đơn có danh sách sản phẩm)
}

// 1 sản phẩm trên hoá đơn đã lưu kèm giao dịch rút: tên, số lượng (có thể lẻ), thành tiền
export interface TxItem {
  name: string
  qty: number
  amount: number
}

// Lệnh chuyển soạn sẵn, chạy ở bước 3 của màn hình Thực thi:
//   transfer: từ quỹ fromFundId sang quỹ toFundId; withdraw: rút từ fromFundId; deposit: nạp vào toFundId
export type OrderType = 'transfer' | 'withdraw' | 'deposit'

export interface FundOrderInput {
  type: OrderType
  fromFundId: string | null
  toFundId: string | null
  amount: number // allBalance = true thì bỏ qua (lưu 0)
  allBalance: boolean // chuyển / rút TOÀN BỘ số dư của quỹ nguồn tại lúc chạy lệnh (không dùng cho lệnh nạp)
  note: string
}

export interface FundOrder extends FundOrderInput {
  id: string
  position: number // số thứ tự chạy (1, 2, 3... liên tục, không trùng); lệnh chạy lần lượt theo số này
  createdAt: Date | null
}

// 1 đợt thực thi theo tháng (id = "YYYY-MM"): bước 1 nhập lương, bước 2 tổng kết, bước 3 chạy lệnh
export interface FundRun {
  month: string
  summarizedByName: string | null // người đã tổng kết; null = chưa tổng kết
  summarizedAt: Date | null
  executed: Record<string, Date> // lệnh đã chạy trong đợt (id lệnh -> lúc chạy); mỗi lệnh chỉ chạy 1 lần mỗi đợt
  // Số dư các quỹ lưu lại lúc tổng kết (id quỹ -> số liệu); null = chưa tổng kết. Dùng cho màn hình Thống kê
  balances: Record<string, FundSnapshot> | null
  total: number | null // tổng số dư lúc tổng kết (không tính quỹ đã chuyển đi)
}

// Số dư của 1 quỹ tại thời điểm tổng kết (lưu kèm tên / icon để quỹ bị xoá sau này vẫn xem được)
export interface FundSnapshot {
  name: string
  icon: string
  balance: number
  transferred: boolean
}

// Lương thực lãnh của 1 thành viên trong đợt (id = uid, mỗi người chỉ sửa được của mình)
export interface Salary {
  uid: string
  name: string
  amount: number
  fundId: string | null // quỹ đã nạp lương vào (null = không chuyển vào quỹ nào)
  updatedAt: Date | null
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
  transferred: boolean
}
