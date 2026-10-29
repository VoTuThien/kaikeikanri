import type { ReactNode } from 'react'

// Kiểu kính mờ dùng chung, xuất ra để dùng cho các khung không phải <GlassPanel> (vd bảng cuộn)
export const GLASS_CLASS =
  'rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl'

export function GlassPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${GLASS_CLASS} ${className}`}>{children}</div>
}
