// Kích thước dùng chung giữa giao diện thật và skeleton.
// Sửa ở đây thì cả hai cùng thay đổi, để chiều cao không bị lệch khi loading xong.
export const SIZE = {
  control: 'h-12', // ô nhập và nút
  chip: 'h-10', // nút nhỏ: chọn nhanh số tiền, bộ lọc
  label: 'h-5', // nhãn của ô nhập
  hint: 'h-10', // dòng ghi chú dưới form (2 dòng chữ nhỏ)
  title: 'h-8',
  subtitle: 'h-5',
  logo: 'h-14 w-14',
  tile: 'h-24', // ô chức năng bên trong mỗi app
  appIcon: 'h-16 w-16', // icon app ở màn hình chính
  appLabel: 'h-4', // tên app dưới icon
  listItem: 'h-20', // thẻ nhóm quỹ trong danh sách
  row: 'h-16', // một dòng giao dịch / một dòng cài đặt
  stat: 'h-14', // ô thống kê (thu gọn để dành chỗ cho bảng)
  sectionTitle: 'h-6', // tiêu đề mục
  stickyHeader: 'h-8', // tiêu đề tháng dính trên đầu bảng khi cuộn
  infoBar: 'h-16', // thanh thông tin dưới bản đồ mini
  tray: 'h-24', // khay địa điểm chưa đặt lên bản đồ mini
} as const
