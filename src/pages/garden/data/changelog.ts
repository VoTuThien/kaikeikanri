// Nội dung "Có gì mới" của game Vườn mây (xem CLAUDE.md "Màn hình Có gì mới").
// MỖI LẦN DEPLOY có thay đổi muốn báo người chơi: thêm 1 mục vào ĐẦU mảng (mới nhất trên cùng).
// - `version`: ngày "YYYY-MM-DD" (deploy nhiều lần / ngày thì thêm ".2", ".3"); phải LỚN HƠN bản trước (so sánh chuỗi).
// - `items`: 3–6 ý ngắn, viết cho người chơi (chữ thuần, không HTML). `image` (tuỳ chọn): ảnh nhỏ ở public/game/news/ (< 100KB, webp).
// Deploy chỉ sửa lỗi nhỏ, không thêm mục → người chơi không bị bật màn hình.
export interface ChangelogEntry { version: string; title: string; items: string[]; image?: string }

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2026-11-20',
    title: 'Thành tựu, nhiệm vụ ngày, đập chậu & phân bón',
    items: [
      'Menu ☰ ở góc phải trên gom các nút: Cẩm nang, Cửa hàng, Nhiệm vụ, Thành tựu, Gacha, Hòm thư, Túi đồ.',
      'Thành tựu: 6 nhóm (Thăng tiến, Thu hoạch, Thu thập, Chăm sóc, Buôn bán, Ước nguyện), lên cấp nhận đá, lông chim, Vọng Tinh, Vọng Nguyệt. Cấp tối đa 90.',
      'Nhiệm vụ hằng ngày: 5 nhiệm vụ mỗi ngày, xong cả 5 được thêm Vọng Nguyệt.',
      'Đập chậu: nâng cấp chậu có tỉ lệ thành công, bỏ thêm chậu trong kho hoặc dùng bùa may mắn để tăng tỉ lệ.',
      'Phân bón: rút ngắn thời gian lớn của cây. Cửa hàng có thêm tab Bùa và Đổi sao (mảnh vỡ sao nhận kèm khi gacha ra món hiếm).',
      'Hòm thư: nhận quà do quản trị gửi.',
    ],
  },
]
export const LATEST_VERSION = CHANGELOG[0]?.version ?? ''
export const NEWS_MAX = 5 // bỏ lỡ nhiều bản thì hiện tối đa 5 bản mới nhất
// Các bản chưa xem (mới nhất trước); `seen` = '' nghĩa là chưa xem bản nào
export const unseenOf = (seen: string) => CHANGELOG.filter((e) => e.version > seen)
