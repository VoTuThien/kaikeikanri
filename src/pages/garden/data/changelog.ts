// Nội dung "Có gì mới" của game Vườn mây (xem CLAUDE.md "Màn hình Có gì mới").
// MỖI LẦN DEPLOY có thay đổi muốn báo người chơi: thêm 1 mục vào ĐẦU mảng (mới nhất trên cùng).
// - `version`: ngày "YYYY-MM-DD" (deploy nhiều lần / ngày thì thêm ".2", ".3"); phải LỚN HƠN bản trước (so sánh chuỗi).
// - `items`: 3–6 ý ngắn, viết cho người chơi (chữ thuần, không HTML). `image` (tuỳ chọn): ảnh nhỏ ở public/game/news/ (< 100KB, webp).
// Deploy chỉ sửa lỗi nhỏ, không thêm mục → người chơi không bị bật màn hình.
export interface ChangelogEntry { version: string; title: string; items: string[]; image?: string }

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2026-11-21',
    title: 'Giao diện mới: cửa hàng, túi đồ, ước nguyện',
    items: [
      'Cửa hàng và Túi đồ toàn màn hình, vật phẩm hiển thị dạng ô vuông có chữ hạng B / A / S, xếp theo S → A → B.',
      'Chạm vào vật phẩm ở Cửa hàng để xem mô tả và kéo chọn số lượng; Túi đồ có khung thông tin chi tiết, bán / đập chậu ngay tại đó.',
      'Màn hình ước nguyện làm mới; thiếu Vọng Tinh khi quay thì có thể đổi bằng đá vũ trụ ngay.',
      'Đổi tên Sao Duyên thành Vọng Nguyệt. Xong cả 5 nhiệm vụ ngày được 2 Vọng Tinh + 2 Vọng Nguyệt.',
      'Chọn hạt / chậu có bộ lọc S, A, B; cây chín chỉ cần chạm vào cây để thu hoạch.',
      'Icon mới cho côn trùng, bùa, phân bón, mảnh vỡ sao.',
    ],
  },
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
