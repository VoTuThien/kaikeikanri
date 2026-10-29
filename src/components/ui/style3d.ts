// Hiệu ứng nổi 3D dùng chung cho icon và các ô chọn

// Khối màu nổi (nền icon app, icon quỹ, ô chọn màu): sáng mép trên, tối mép dưới, đổ bóng xuống nền
export const BLOCK_3D =
  'shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-4px_0_rgba(0,0,0,0.22),0_4px_8px_rgba(0,0,0,0.35)]'

// Lớp bóng loáng ở nửa trên khối, tạo cảm giác bề mặt cong (đặt trong khối có `relative`)
export const GLOSS_3D =
  'pointer-events-none absolute inset-x-1 top-1 h-2/5 rounded-[inherit] bg-gradient-to-b from-white/50 to-transparent'

// Ô kính nổi (ô chọn biểu tượng)
export const TILE_3D =
  'bg-gradient-to-b from-white/30 to-white/5 border border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-3px_0_rgba(0,0,0,0.18),0_4px_8px_rgba(0,0,0,0.3)] hover:from-white/40 active:translate-y-0.5'

// Ô kính đang được chọn: nổi cao hơn, có quầng sáng hồng
export const TILE_3D_SELECTED =
  '-translate-y-0.5 bg-gradient-to-b from-fuchsia-300/70 to-indigo-400/40 border border-fuchsia-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-3px_0_rgba(0,0,0,0.2),0_8px_16px_rgba(217,70,239,0.5)]'
