// Kiểu khối nền icon / ô chọn dùng chung. Đã bỏ hiệu ứng nổi 3D (viền sáng / tối bên trong, lớp bóng loáng):
// khối PHẲNG, chỉ giữ bóng đổ để nổi khỏi nền. Tên cũ giữ nguyên để không phải sửa chỗ dùng.

// Khối màu (nền icon app, icon quỹ, ô chọn màu): phẳng + bóng đổ
export const BLOCK_3D = 'shadow-[0_4px_10px_rgba(0,0,0,0.35)]'

// Lớp bóng loáng cũ: không còn dùng (để rỗng cho các chỗ đang gắn)
export const GLOSS_3D = 'hidden'

// Ô kính (ô chọn biểu tượng): phẳng + bóng đổ
export const TILE_3D = 'bg-white/15 border border-white/25 shadow-[0_4px_10px_rgba(0,0,0,0.3)] hover:bg-white/25'

// Ô kính đang được chọn: nền tím hồng + quầng sáng
export const TILE_3D_SELECTED =
  'bg-gradient-to-b from-fuchsia-400/70 to-indigo-500/50 border border-fuchsia-100/70 shadow-[0_6px_14px_rgba(217,70,239,0.45)]'
