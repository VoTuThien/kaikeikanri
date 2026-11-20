import type { ReactNode } from 'react'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import { DragScroll } from './DragScroll'
import { GLASS_ROUND } from './glass'

// Màn hình popup toàn khung game, bố cục giống Thành tựu (AchievementsUi): thanh trên [đóng] [tiêu đề + dòng phụ] [nút hành động bên phải],
// cột trái = các tab (icon + tên, chấm số), bên phải = danh sách cuộn dọc (DragScroll). Dùng cho Cửa hàng, Túi đồ.
export interface SideTab<T extends string> { id: T; label: string; icon: string; badge?: number }

export function SideTabScreen<T extends string>({ title, sub, closeLabel, onClose, action, tabs, tab, setTab, children, overlay, aside }: {
  title?: string // bỏ trống = không có tiêu đề (vd Cửa hàng: thanh trên chỉ có nút đóng + tiền tệ)
  sub?: ReactNode
  closeLabel: string
  onClose: () => void
  action?: ReactNode // nút bên phải thanh trên (vd Bán tất cả)
  tabs: SideTab<T>[]
  tab: T
  setTab: (t: T) => void
  children: ReactNode
  overlay?: ReactNode // lớp phủ trong màn hình (vd chọn loại khi đổi sao)
  aside?: ReactNode // cột chi tiết bên phải (vd Túi đồ: thông tin vật phẩm đang chọn)
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-br from-[#120a33]/95 via-[#24104d]/95 to-[#3b1450]/95 backdrop-blur-xl">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/15" style={{ paddingLeft: 'calc(var(--safe-l) + 12px)', paddingRight: 'calc(var(--safe-r) + 12px)' }}>
        <button type="button" data-round aria-label={closeLabel} onClick={onClose} className={`${GLASS_ROUND} h-10 w-10`}>
          <LineIcon icon="cancel" className="h-5 w-5" />
        </button>
        <div className="ml-1 min-w-0 flex-1">
          {title && <p className="text-lg leading-6 font-light">{title}</p>}
          {sub && <p className="truncate text-xs leading-4 text-white/65">{sub}</p>}
        </div>
        {action}
      </div>

      <div className="flex min-h-0 flex-1" style={{ paddingLeft: 'var(--safe-l)', paddingRight: 'var(--safe-r)' }}>
        <div className="flex w-36 shrink-0 flex-col gap-1 border-r border-white/15 p-2">
          {tabs.map((t) => {
            const on = t.id === tab
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`relative flex h-11 items-center gap-2 border px-2 text-left text-sm font-semibold transition ${on ? 'border-amber-200/70 bg-white/15' : 'border-white/10 bg-white/5 text-white/80'}`}>
                <Icon3D emoji={t.icon} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{t.label}</span>
                {!!t.badge && <span data-round className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-bold">{t.badge}</span>}
              </button>
            )
          })}
        </div>
        <DragScroll key={tab} axis="y" className="min-h-0 flex-1">
          {children}
          <div className="h-4" />
        </DragScroll>
        {aside && <div className="flex w-72 shrink-0 flex-col border-l border-white/15">{aside}</div>}
      </div>
      {overlay}
    </div>
  )
}
